<!--
  LEGACY NOTICE:
  This sidepanel-based RAG/chat implementation is now considered legacy.
  It remains in the extension temporarily for local testing and backward compatibility
  while the project moves toward a dedicated backend/FastAPI architecture.
  Prefer evolving the new backend path rather than extending this file further.
-->
<script>
  import { onMount, tick } from 'svelte';
  import { embedDocumentsIfNeeded, embedQuestion } from '@services/gemini-embeddings.js';
  import {
    extractBatchFindings,
    GEMINI_MODELS,
    streamTabChat,
    synthesizeExhaustiveAnswer,
    verifyTabAnswer,
  } from '@services/gemini.js';
  import { loadSessionDocuments, saveSessionDocumentRecords, saveSessionDocuments } from '../lib/chat-doc-store.js';
  import { collectEvidenceChunksByIds, createExhaustiveBatches, planQuestionMode } from '../lib/chat-exhaustive.js';
  import { extractTabContentByFetch } from '../lib/chat-fetch-extractor.js';
  import { retrieveRelevantChunks } from '../lib/chat-retrieval.js';
  import {
    CHAT_LAUNCH_CONTEXT_KEY,
    createChatSession,
    getChatSessionTitle,
    loadChatSessions,
    saveChatSessions,
  } from '../lib/utils.js';

  const CHAT_SETTINGS_KEY = 'tabdogChatSettings';
  const MAX_SELECTED_TABS = 2;
  const MAX_STORED_MESSAGES = 24;
  const LAUNCH_CONTEXT_TTL_MS = 60 * 1000;
  const DEBUG_PREFIX = '[TabDog Chat][SidePanel]';

  let darkMode = $state(false);
  let tabs = $state([]);
  let selectedTabIds = $state([]);
  let messages = $state([]);
  let tabSummaries = $state([]);
  let availableDocuments = $state([]);
  let apiKey = $state('');
  let model = $state(GEMINI_MODELS[0].id);
  let inputValue = $state('');
  let statusMessage = $state('');
  let errorMessage = $state('');
  let usageMessage = $state('');
  let settingsSavedMessage = $state('');
  let isLoadingTabs = $state(true);
  let isSending = $state(false);
  let activeSessionId = $state('');
  let messagesViewport = $state(null);
  let abortController = null;

  const eligibleTabs = $derived.by(() =>
    tabs.filter((tab) => tab.isSupported),
  );

  const selectedTabs = $derived.by(() =>
    eligibleTabs.filter((tab) => selectedTabIds.includes(tab.id)),
  );

  const canSend = $derived.by(() =>
    Boolean(apiKey.trim() && inputValue.trim() && (selectedTabs.length > 0 || availableDocuments.length > 0) && !isSending),
  );

  function getOriginPattern(url) {
    const parsed = new URL(url);
    return `${parsed.origin}/*`;
  }

  function createMessage(role, content, extra = {}) {
    return {
      id: crypto.randomUUID(),
      role,
      content,
      createdAt: Date.now(),
      ...extra,
    };
  }

  function pruneMessages(messageList) {
    return messageList.slice(-MAX_STORED_MESSAGES);
  }

  function isSupportedUrl(url) {
    return /^https?:\/\//.test(url || '');
  }

  function formatHost(url) {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return url || '';
    }
  }

  function formatUsage(usageMetadata) {
    if (!usageMetadata) return '';

    const parts = [];
    if (usageMetadata.promptTokenCount != null) {
      parts.push(`Prompt ${usageMetadata.promptTokenCount}`);
    }
    if (usageMetadata.candidatesTokenCount != null) {
      parts.push(`Output ${usageMetadata.candidatesTokenCount}`);
    }
    if (usageMetadata.totalTokenCount != null) {
      parts.push(`Total ${usageMetadata.totalTokenCount}`);
    }

    return parts.length ? `${parts.join(' · ')} tokens` : '';
  }

  function logDebug(label, payload) {
    if (payload === undefined) {
      console.log(`${DEBUG_PREFIX} ${label}`);
      return;
    }

    console.log(`${DEBUG_PREFIX} ${label}`, payload);
  }

  function dedupeBy(items, keyFn) {
    const seen = new Set();
    const result = [];

    for (const item of items) {
      const key = keyFn(item);
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(item);
    }

    return result;
  }

  function mergeExhaustiveFindings(batchFindings) {
    const merged = [];

    for (const batchResult of batchFindings) {
      for (const finding of batchResult.findings || []) {
        merged.push({
          ...finding,
          chunkIds: dedupeBy(finding.chunkIds || [], (item) => item),
          quotes: dedupeBy(finding.quotes || [], (item) => item),
        });
      }
    }

    return dedupeBy(merged, (finding) =>
      `${finding.statement}::${(finding.chunkIds || []).join('|')}`,
    );
  }

  function dedupeEvidenceChunks(evidenceChunks) {
    return dedupeBy(evidenceChunks || [], (chunk) => chunk.chunkId);
  }

  function reconcileExtractionResults(tab, fetchResult, domResult) {
    const fetchOk = Boolean(fetchResult?.ok);
    const domOk = Boolean(domResult?.ok);

    logDebug('Reconciling extraction results', {
      tab,
      fetchOk,
      domOk,
      fetchResult,
      domResult,
    });

    if (fetchOk && domOk) {
      const fetchChars = fetchResult.charCount || fetchResult.content?.length || 0;
      const domChars = domResult.charCount || domResult.content?.length || 0;
      const domLooksRicher =
        domChars > fetchChars + 1500 ||
        (fetchChars > 0 && domChars / fetchChars >= 1.25);

      if (domLooksRicher) {
        const merged = {
          ...fetchResult,
          title: domResult.title || fetchResult.title || tab.title,
          url: domResult.url || fetchResult.url || tab.url,
          excerpt: domResult.excerpt || fetchResult.excerpt || '',
          content: domResult.content,
          charCount: domChars,
          truncated: false,
          truncatedCharCount: domChars,
          strategy: `${fetchResult.strategy}+dom-rendered`,
          mergeReason: 'dom-richer-than-fetch',
          rawDomCharCount: domChars,
          rawFetchCharCount: fetchChars,
        };

        logDebug('Using merged extraction with DOM content', merged);
        return merged;
      }

      const merged = {
        ...fetchResult,
        mergeReason: 'fetch-close-to-dom',
        rawDomCharCount: domChars,
        rawFetchCharCount: fetchChars,
      };

      logDebug('Using fetch extraction as primary source', merged);
      return merged;
    }

    if (fetchOk) {
      logDebug('Using fetch extraction only', fetchResult);
      return fetchResult;
    }

    if (domOk) {
      logDebug('Using DOM extraction only', domResult);
      return domResult;
    }

    return null;
  }

  function updateAssistantMessage(messageId, updater) {
    messages = messages.map((message) =>
      message.id === messageId
        ? {
            ...message,
            content: updater(message.content),
          }
        : message,
    );
  }

  function patchMessage(messageId, patch) {
    messages = messages.map((message) =>
      message.id === messageId
        ? {
            ...message,
            ...patch,
          }
        : message,
    );
  }

  async function scrollMessagesToBottom() {
    await tick();
    messagesViewport?.scrollTo({
      top: messagesViewport.scrollHeight,
      behavior: 'smooth',
    });
  }

  function resetConversationState() {
    activeSessionId = '';
    messages = [];
    tabSummaries = [];
    availableDocuments = [];
    usageMessage = '';
  }

  function buildSessionTabRefs(tabList = selectedTabs, summaries = tabSummaries) {
    if (tabList.length) {
      return tabList.slice(0, MAX_SELECTED_TABS).map((tab) => ({
        tabId: tab.id,
        url: tab.url || '',
        title: tab.title || 'Untitled tab',
      }));
    }

    return (summaries || []).map((summary) => ({
      tabId: summary?.tabId,
      url: summary?.url || '',
      title: summary?.title || 'Untitled tab',
    }));
  }

  function isFreshLaunchContext(context) {
    return Boolean(
      context &&
      typeof context.tabId === 'number' &&
      Date.now() - (context.createdAt || 0) < LAUNCH_CONTEXT_TTL_MS,
    );
  }

  function findTabSelectionForSession(tabList, session) {
    const refs = Array.isArray(session?.tabRefs) && session.tabRefs.length
      ? session.tabRefs
      : (session?.tabSummaries || []).map((summary) => ({
          tabId: summary?.tabId,
          url: summary?.url || '',
        }));

    const used = new Set();
    const matches = [];

    for (const ref of refs) {
      let match = null;

      if (typeof ref.tabId === 'number') {
        match = tabList.find((tab) =>
          !used.has(tab.id) &&
          tab.id === ref.tabId &&
          (!ref.url || tab.url === ref.url),
        );
      }

      if (!match && ref.url) {
        match = tabList.find((tab) => !used.has(tab.id) && tab.url === ref.url);
      }

      if (!match || !match.isSupported) {
        continue;
      }

      used.add(match.id);
      matches.push(match.id);

      if (matches.length >= MAX_SELECTED_TABS) {
        break;
      }
    }

    return matches;
  }

  async function loadSettings() {
    const result = await chrome.storage.local.get(CHAT_SETTINGS_KEY);
    const settings = result[CHAT_SETTINGS_KEY] || {};
    apiKey = settings.apiKey || '';
    model = settings.model || GEMINI_MODELS[0].id;
  }

  async function saveSettings() {
    await chrome.storage.local.set({
      [CHAT_SETTINGS_KEY]: {
        apiKey: apiKey.trim(),
        model,
      },
    });

    settingsSavedMessage = 'Settings saved locally.';
    setTimeout(() => {
      settingsSavedMessage = '';
    }, 1800);
  }

  async function loadSession(sessionId) {
    const sessions = await loadChatSessions();
    const session = sessions[sessionId];

    if (!session) {
      logDebug('Requested session was not found', { sessionId });
      return null;
    }

    logDebug('Loaded session', session);
    activeSessionId = session.id;
    messages = session.messages || [];
    tabSummaries = session.tabSummaries || [];
    availableDocuments = await loadSessionDocuments(session.id);
    usageMessage = session.usageMessage || '';
    await scrollMessagesToBottom();
    return session;
  }

  async function persistConversation(sessionId = activeSessionId) {
    if (!sessionId) return;

    const sessions = await loadChatSessions();
    const existing = sessions[sessionId];
    const createdAt = existing?.createdAt || Date.now();

    const nextSession = {
      ...(existing || {}),
      id: sessionId,
      createdAt,
      updatedAt: Date.now(),
      messages: pruneMessages(messages),
      tabSummaries,
      tabRefs: buildSessionTabRefs(),
      usageMessage,
    };

    nextSession.title = getChatSessionTitle(nextSession);
    sessions[sessionId] = nextSession;
    logDebug('Persisting conversation', nextSession);
    await saveChatSessions(sessions);
    activeSessionId = sessionId;
  }

  async function loadTabs({ keepSelection = true, launchContext = null, launchSession = null } = {}) {
    isLoadingTabs = true;

    try {
      const chromeTabs = await chrome.tabs.query({ currentWindow: true });
      const nextTabs = chromeTabs
        .map((tab) => ({
          id: tab.id,
          title: tab.title || 'Untitled tab',
          url: tab.url || '',
          active: Boolean(tab.active),
          favIconUrl: tab.favIconUrl || '',
          hostname: formatHost(tab.url),
          isSupported: isSupportedUrl(tab.url),
        }))
        .sort((a, b) => {
          if (a.active) return -1;
          if (b.active) return 1;
          return a.title.localeCompare(b.title);
        });

      tabs = nextTabs;
      logDebug('Loaded tabs for sidepanel', nextTabs);

      if (isFreshLaunchContext(launchContext)) {
        logDebug('Applying launch context during tab load', {
          launchContext,
          launchSession,
        });
        if (launchContext.mode === 'conversation' && launchSession) {
          const matchedIds = findTabSelectionForSession(nextTabs, launchSession);
          selectedTabIds = matchedIds;
          availableDocuments = await loadSessionDocuments(launchSession.id);

          if (!matchedIds.length && (launchSession.tabRefs?.length || launchSession.tabSummaries?.length)) {
            statusMessage = 'Saved conversation opened. Select an open tab to continue chatting.';
          } else {
            statusMessage = '';
          }

          return;
        }

        const launchTab = nextTabs.find((tab) => tab.id === launchContext.tabId && tab.isSupported);
        if (launchTab) {
          selectedTabIds = [launchTab.id];
        } else {
          selectedTabIds = [];
        }
        return;
      }

      if (keepSelection) {
        const validIds = new Set(nextTabs.map((tab) => tab.id));
        selectedTabIds = selectedTabIds.filter((tabId) => validIds.has(tabId));
      } else {
        selectedTabIds = [];
      }

      if (!selectedTabIds.length) {
        const activeTab = nextTabs.find((tab) => tab.active && tab.isSupported);
        if (activeTab) {
          selectedTabIds = [activeTab.id];
        }
      }

      if (activeSessionId) {
        availableDocuments = await loadSessionDocuments(activeSessionId);
      }
    } finally {
      isLoadingTabs = false;
    }
  }

  async function handleLaunchContext(launchContext) {
    if (!isFreshLaunchContext(launchContext)) {
      logDebug('Ignoring stale or invalid launch context', launchContext);
      return false;
    }

    logDebug('Handling launch context', launchContext);

    abortController?.abort();
    abortController = null;
    isSending = false;
    errorMessage = '';
    settingsSavedMessage = '';
    statusMessage = '';

    let launchSession = null;

    if (launchContext.mode === 'conversation' && launchContext.sessionId) {
      launchSession = await loadSession(launchContext.sessionId);

      if (!launchSession) {
        resetConversationState();
        errorMessage = 'This conversation is no longer available.';
        logDebug('Launch session missing', { sessionId: launchContext.sessionId });
      }
    } else {
      resetConversationState();
    }

    await loadTabs({
      keepSelection: false,
      launchContext,
      launchSession,
    });

    await chrome.storage.local.remove(CHAT_LAUNCH_CONTEXT_KEY);
    return true;
  }

  async function ensureTabAccess(tab) {
    const originPattern = getOriginPattern(tab.url);
    const alreadyGranted = await chrome.permissions.contains({
      origins: [originPattern],
    });

    if (alreadyGranted) {
      return true;
    }

    return chrome.permissions.request({
      origins: [originPattern],
    });
  }

  async function extractSelectedTabContexts(tabList) {
    const contexts = [];

    for (const tab of tabList) {
      logDebug('Preparing tab extraction', tab);
      statusMessage = `Requesting access to ${tab.title}...`;
      const granted = await ensureTabAccess(tab);
      if (!granted) {
        throw new Error(`Site access was denied for ${tab.hostname || tab.title}.`);
      }

      statusMessage = `Reading ${tab.title}...`;
      const [fetchAttempt, domAttempt] = await Promise.allSettled([
        extractTabContentByFetch(tab),
        chrome.runtime.sendMessage({
          action: 'extractTabContent',
          tabId: tab.id,
        }),
      ]);

      const fetchResult = fetchAttempt.status === 'fulfilled'
        ? fetchAttempt.value
        : null;
      const domResult = domAttempt.status === 'fulfilled'
        ? domAttempt.value
        : null;

      if (fetchAttempt.status === 'rejected') {
        logDebug('Fetch extraction failed', {
          tab,
          error: fetchAttempt.reason,
          message: fetchAttempt.reason?.message,
        });
      } else {
        logDebug('Fetch extraction success', fetchResult);
      }

      if (domAttempt.status === 'rejected') {
        logDebug('DOM extraction request failed', {
          tab,
          error: domAttempt.reason,
          message: domAttempt.reason?.message,
        });
      } else {
        logDebug('DOM extraction success', domResult);
      }

      const finalResult = reconcileExtractionResults(tab, fetchResult, domResult);
      if (!finalResult?.ok) {
        logDebug('Tab extraction failed after reconciliation', {
          tab,
          fetchResult,
          domResult,
        });
        throw new Error(
          finalResult?.message ||
          fetchAttempt.reason?.message ||
          domAttempt.reason?.message ||
          `Failed to read ${tab.title}.`,
        );
      }

      contexts.push(finalResult);
    }

    return contexts;
  }

  async function resolveDocumentsForQuestion(sessionId) {
    if (selectedTabs.length > 0) {
      const contexts = await extractSelectedTabContexts(selectedTabs);
      const storedDocuments = await saveSessionDocuments(sessionId, contexts);
      availableDocuments = storedDocuments;

      return {
        contexts,
        documents: storedDocuments,
        source: 'fresh-extraction',
      };
    }

    const storedDocuments = await loadSessionDocuments(sessionId);
    availableDocuments = storedDocuments;

    if (!storedDocuments.length) {
      throw new Error('No stored tab content is available. Select a tab to continue.');
    }

    return {
      contexts: [],
      documents: storedDocuments,
      source: 'stored-documents',
    };
  }

  async function ensureEmbeddingsForDocuments(sessionId, documents, question) {
    try {
      statusMessage = 'Embedding document chunks for retrieval...';
      const embeddedDocuments = await embedDocumentsIfNeeded({
        apiKey,
        documents,
        signal: abortController?.signal,
      });
      await saveSessionDocumentRecords(embeddedDocuments);
      availableDocuments = embeddedDocuments;

      statusMessage = 'Embedding your question...';
      const queryEmbedding = await embedQuestion({
        apiKey,
        question,
        signal: abortController?.signal,
      });

      logDebug('Embedding pipeline complete', {
        sessionId,
        documentCount: embeddedDocuments.length,
        queryEmbeddingLength: queryEmbedding.length,
      });

      return {
        documents: embeddedDocuments,
        queryEmbedding,
      };
    } catch (embeddingError) {
      logDebug('Embedding pipeline failed, continuing with lexical retrieval only', {
        error: embeddingError,
        message: embeddingError?.message,
      });

      return {
        documents,
        queryEmbedding: null,
      };
    }
  }

  async function runExhaustiveQuestionMode({ question, documents }) {
    const batches = createExhaustiveBatches(documents, selectedTabIds);
    const batchFindings = [];
    const relevantEvidence = [];

    for (let index = 0; index < batches.length; index += 1) {
      const batch = batches[index];
      statusMessage = `Sweeping sections ${index + 1}/${batches.length}...`;

      const result = await extractBatchFindings({
        apiKey,
        model,
        question,
        evidenceChunks: batch.evidenceChunks,
        signal: abortController.signal,
      });

      logDebug('Exhaustive batch findings', {
        batch,
        result,
      });

      if (result.relevant) {
        batchFindings.push(result);
        relevantEvidence.push(...batch.evidenceChunks);
      }
    }

    const mergedFindings = mergeExhaustiveFindings(batchFindings);
    logDebug('Merged exhaustive findings', mergedFindings);

    if (!mergedFindings.length) {
      return {
        draftAnswer: '해당 열린 탭 내용만으로는 확인되지 않습니다.',
        evidenceChunks: [],
        synthesis: {
          supported: false,
          answer: '해당 열린 탭 내용만으로는 확인되지 않습니다.',
          citations: [],
          unsupportedClaims: [],
          missingInformation: ['No relevant evidence was found across the selected tabs.'],
        },
      };
    }

    const citedChunkIds = dedupeBy(
      mergedFindings.flatMap((finding) => finding.chunkIds || []),
      (item) => item,
    );

    const citedEvidence = collectEvidenceChunksByIds(documents, selectedTabIds, citedChunkIds);
    const finalEvidenceChunks = dedupeEvidenceChunks([
      ...citedEvidence,
      ...relevantEvidence,
    ]);

    statusMessage = 'Synthesizing exhaustive answer...';
    const synthesis = await synthesizeExhaustiveAnswer({
      apiKey,
      model,
      question,
      findings: mergedFindings,
      signal: abortController.signal,
    });

    logDebug('Exhaustive synthesis result', synthesis);

    return {
      draftAnswer: synthesis.answer || '해당 열린 탭 내용만으로는 확인되지 않습니다.',
      evidenceChunks: finalEvidenceChunks,
      synthesis,
    };
  }

  function toggleTabSelection(tabId) {
    errorMessage = '';
    statusMessage = '';

    if (selectedTabIds.includes(tabId)) {
      selectedTabIds = selectedTabIds.filter((id) => id !== tabId);
      return;
    }

    if (selectedTabIds.length >= MAX_SELECTED_TABS) {
      errorMessage = 'You can compare up to 2 tabs at a time.';
      return;
    }

    selectedTabIds = [...selectedTabIds, tabId];
  }

  async function stopStreaming() {
    abortController?.abort();
    abortController = null;
    isSending = false;
    statusMessage = 'Response stopped.';
    await persistConversation();
  }

  async function submitMessage() {
    if (!canSend) return;

    errorMessage = '';
    usageMessage = '';
    settingsSavedMessage = '';
    statusMessage = 'Preparing your selected tabs...';

    await saveSettings();

    const sessionId = activeSessionId || createChatSession({ selectedTabs }).id;
    activeSessionId = sessionId;

    const userMessage = createMessage('user', inputValue.trim());
    const assistantMessage = createMessage('assistant', '');
    logDebug('Submitting message', {
      sessionId,
      question: userMessage.content,
      selectedTabs,
      model,
    });
    inputValue = '';
    messages = [...messages, userMessage, assistantMessage];
    await scrollMessagesToBottom();

    isSending = true;
    abortController?.abort();
    abortController = new AbortController();

    try {
      await persistConversation(sessionId);

      const { contexts, documents, source } = await resolveDocumentsForQuestion(sessionId);

      if (contexts.length > 0) {
        tabSummaries = contexts.map((context) => ({
          tabId: context.tabId,
          title: context.title,
          url: context.url,
          strategy: context.strategy,
          truncated: context.truncated,
          charCount: context.charCount,
        }));
      } else {
        tabSummaries = documents.map((documentRecord) => ({
          tabId: documentRecord.tabId,
          title: documentRecord.title,
          url: documentRecord.url,
          strategy: documentRecord.strategy,
          truncated: false,
          charCount: documentRecord.charCount,
        }));
      }

      logDebug('Context source for question', {
        source,
        contextCount: contexts.length,
        documentCount: documents.length,
      });
      logDebug('Built tab summaries for prompt', tabSummaries);
      logDebug('Full extracted contexts for prompt', contexts);

      const questionMode = planQuestionMode({
        question: userMessage.content,
        documents,
        selectedTabIds,
      });
      logDebug('Question mode selected', questionMode);

      let draftAnswer = '';
      let evidenceChunks = [];
      let responseUsage = null;
      let preVerifiedResult = null;

      if (questionMode.mode === 'exhaustive') {
        const exhaustiveResult = await runExhaustiveQuestionMode({
          question: userMessage.content,
          documents,
        });
        draftAnswer = exhaustiveResult.draftAnswer;
        evidenceChunks = exhaustiveResult.evidenceChunks;
        preVerifiedResult = exhaustiveResult.synthesis;
        patchMessage(assistantMessage.id, {
          content: draftAnswer,
        });
        await scrollMessagesToBottom();
      } else {
        const embeddingState = await ensureEmbeddingsForDocuments(
          sessionId,
          documents,
          userMessage.content,
        );

        statusMessage = 'Retrieving the most relevant evidence...';
        evidenceChunks = retrieveRelevantChunks({
          documents: embeddingState.documents,
          question: userMessage.content,
          selectedTabIds,
          queryEmbedding: embeddingState.queryEmbedding,
        });
        logDebug('Retrieved evidence chunks for prompt', evidenceChunks);

        statusMessage = 'Streaming answer from Gemini...';
        await persistConversation(sessionId);

        const response = await streamTabChat({
          apiKey,
          model,
          messages: [...messages].filter((message) => message.id !== assistantMessage.id),
          evidenceChunks,
          signal: abortController.signal,
          onChunk: async (chunk) => {
            logDebug('Received Gemini chunk', chunk);
            updateAssistantMessage(assistantMessage.id, (content) => `${content}${chunk}`);
            await scrollMessagesToBottom();
          },
        });

        logDebug('Gemini response complete', response);
        draftAnswer = response.text;
        responseUsage = response.usageMetadata;
      }

      statusMessage = 'Verifying evidence and pruning unsupported claims...';

      try {
        const verification = await verifyTabAnswer({
          apiKey,
          model,
          question: userMessage.content,
          draftAnswer,
          evidenceChunks,
          signal: abortController.signal,
        });

        logDebug('Verifier result', verification);
        patchMessage(assistantMessage.id, {
          content: verification.answer || response.text,
          citations: verification.citations || [],
          supported: verification.supported,
          unsupportedClaims: verification.unsupportedClaims || [],
          missingInformation: verification.missingInformation || [],
        });
      } catch (verificationError) {
        logDebug('Verifier failed, keeping original answer', {
          error: verificationError,
          message: verificationError?.message,
        });

        if (preVerifiedResult) {
          patchMessage(assistantMessage.id, {
            content: preVerifiedResult.answer || draftAnswer,
            citations: preVerifiedResult.citations || [],
            supported: preVerifiedResult.supported,
            unsupportedClaims: preVerifiedResult.unsupportedClaims || [],
            missingInformation: preVerifiedResult.missingInformation || [],
          });
        }
      }

      usageMessage = formatUsage(responseUsage);
      statusMessage = '';
      await persistConversation(sessionId);
    } catch (error) {
      logDebug('Submit message failed', {
        error,
        message: error?.message,
        selectedTabs,
        activeSessionId: sessionId,
      });
      const isAbort = error?.name === 'AbortError';
      if (!isAbort) {
        errorMessage = error?.message || 'Something went wrong while generating a response.';
      }

      const hasAssistantContent = messages.find((message) => message.id === assistantMessage.id)?.content;
      if (!hasAssistantContent) {
        messages = messages.filter((message) => message.id !== assistantMessage.id);
      }

      statusMessage = isAbort ? 'Response stopped.' : '';
      await persistConversation(sessionId);
    } finally {
      isSending = false;
      abortController = null;
    }
  }

  onMount(() => {
    const handleStorageChanged = (changes, areaName) => {
      if (areaName !== 'local') {
        return;
      }

      if (changes.theme) {
        darkMode = changes.theme.newValue === 'dark';
        document.documentElement.classList.toggle('dark-mode', darkMode);
      }

      if (changes[CHAT_LAUNCH_CONTEXT_KEY]?.newValue) {
        handleLaunchContext(changes[CHAT_LAUNCH_CONTEXT_KEY].newValue);
      }
    };

    const refreshTabs = () => {
      logDebug('Refreshing tab list because Chrome tab state changed');
      loadTabs();
    };

    chrome.storage.onChanged.addListener(handleStorageChanged);
    chrome.tabs.onActivated.addListener(refreshTabs);
    chrome.tabs.onCreated.addListener(refreshTabs);
    chrome.tabs.onRemoved.addListener(refreshTabs);
    chrome.tabs.onUpdated.addListener(refreshTabs);

    (async () => {
      const themeResult = await chrome.storage.local.get('theme');
      darkMode = themeResult.theme === 'dark';
      document.documentElement.classList.toggle('dark-mode', darkMode);
      logDebug('Sidepanel mounted', {
        darkMode,
        themeResult,
      });

      await loadSettings();
      logDebug('Loaded chat settings', {
        model,
        hasApiKey: Boolean(apiKey),
        apiKeyLength: apiKey?.length || 0,
      });

      const launchResult = await chrome.storage.local.get(CHAT_LAUNCH_CONTEXT_KEY);
      const launchContext = launchResult[CHAT_LAUNCH_CONTEXT_KEY];
      const handledLaunch = launchContext ? await handleLaunchContext(launchContext) : false;

      if (!handledLaunch) {
        resetConversationState();
        await loadTabs();
      }
    })();

    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChanged);
      chrome.tabs.onActivated.removeListener(refreshTabs);
      chrome.tabs.onCreated.removeListener(refreshTabs);
      chrome.tabs.onRemoved.removeListener(refreshTabs);
      chrome.tabs.onUpdated.removeListener(refreshTabs);
      abortController?.abort();
    };
  });
</script>

<div class="sidepanel-container">
  <header class="sidepanel-header">
    <div class="header-title">
      <svg class="logo" viewBox="0 0 16 16" fill="currentColor">
        <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zM0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8z"/>
        <path d="M6.5 6a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm5 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm-7.46 3.08a.5.5 0 0 1 .692-.138c.36.226.926.394 1.636.519C7.074 9.584 7.973 9.64 8 9.64c.027 0 .926-.056 1.632-.181.71-.125 1.276-.293 1.636-.519a.5.5 0 0 1 .554.832C11.162 10.2 10.428 10.4 9.67 10.54 8.91 10.68 8.186 10.74 8 10.74s-.91-.06-1.67-.2c-.758-.14-1.492-.34-2.152-.77a.5.5 0 0 1-.138-.692z"/>
      </svg>
      <div>
        <div>TabDog Chat</div>
        <p class="header-subtitle">Ask questions about up to 2 tabs</p>
      </div>
    </div>
    <button class="refresh-button" onclick={() => loadTabs()}>
      Refresh
    </button>
  </header>

  <main class="sidepanel-content">
    <section class="panel-card">
      <div class="section-heading">
        <h2>Settings</h2>
        {#if settingsSavedMessage}
          <span class="hint success">{settingsSavedMessage}</span>
        {/if}
      </div>

      <label class="field">
        <span>Gemini API key</span>
        <input
          type="password"
          bind:value={apiKey}
          placeholder="Paste your Gemini API key"
          autocomplete="off"
          spellcheck="false"
        />
      </label>

      <label class="field">
        <span>Model</span>
        <select bind:value={model}>
          {#each GEMINI_MODELS as modelOption}
            <option value={modelOption.id}>
              {modelOption.label} · {modelOption.description}
            </option>
          {/each}
        </select>
      </label>

      <div class="settings-actions">
        <button class="secondary-button" onclick={saveSettings}>
          Save settings
        </button>
        <p class="hint">Stored only in this Chrome profile.</p>
      </div>
    </section>

    <section class="panel-card">
      <div class="section-heading">
        <h2>Selected tabs</h2>
        <span class="hint">{selectedTabs.length}/{MAX_SELECTED_TABS} selected</span>
      </div>

      {#if isLoadingTabs}
        <p class="hint">Loading tabs...</p>
      {:else if !tabs.length}
        <p class="hint">No tabs found in this window.</p>
      {:else}
        <div class="tab-list">
          {#each tabs as tab}
            <button
              class="tab-option"
              class:selected={selectedTabIds.includes(tab.id)}
              class:disabled={!tab.isSupported}
              onclick={() => tab.isSupported && toggleTabSelection(tab.id)}
              disabled={!tab.isSupported}
            >
              <div class="tab-option-main">
                <span class="tab-option-title">{tab.title}</span>
                <span class="tab-option-host">{tab.hostname}</span>
              </div>
              <span class="tab-option-meta">
                {#if !tab.isSupported}
                  Unsupported
                {:else if tab.active}
                  Active
                {:else if selectedTabIds.includes(tab.id)}
                  Selected
                {/if}
              </span>
            </button>
          {/each}
        </div>
      {/if}

      {#if tabSummaries.length}
        <div class="summary-list">
          {#each tabSummaries as summary}
            <div class="summary-item">
              <strong>{summary.title}</strong>
              <span>{summary.strategy} · {summary.charCount} chars{summary.truncated ? ' · truncated' : ''}</span>
            </div>
          {/each}
        </div>
      {/if}
    </section>

    <section class="panel-card chat-card">
      <div class="section-heading">
        <h2>Conversation</h2>
        {#if usageMessage}
          <span class="hint">{usageMessage}</span>
        {/if}
      </div>

      {#if errorMessage}
        <div class="banner error">{errorMessage}</div>
      {/if}

      {#if statusMessage}
        <div class="banner status">{statusMessage}</div>
      {/if}

      <div class="messages" bind:this={messagesViewport}>
        {#if !messages.length}
          <div class="empty-state">
            <div class="empty-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <h3>Chat with your tabs</h3>
            <p>Select one or two tabs, save your API key, and ask a question.</p>
          </div>
        {:else}
          {#each messages as message}
            <article class="message-row" class:user={message.role === 'user'}>
              <div class="message-bubble" class:user={message.role === 'user'}>
                <div class="message-role">
                  {message.role === 'user' ? 'You' : 'TabDog'}
                </div>
                <p>{message.content || (isSending && message.role === 'assistant' ? 'Thinking...' : '')}</p>
                {#if message.role === 'assistant' && message.citations?.length}
                  <div class="citation-list">
                    {#each message.citations as citation}
                      <div class="citation-item">
                        <strong>{citation.chunkId}</strong>
                        <span>{citation.quote}</span>
                      </div>
                    {/each}
                  </div>
                {/if}
                {#if message.role === 'assistant' && message.missingInformation?.length}
                  <div class="missing-info">
                    <strong>Missing info</strong>
                    <span>{message.missingInformation.join(' · ')}</span>
                  </div>
                {/if}
              </div>
            </article>
          {/each}
        {/if}
      </div>

      <form
        class="composer"
        onsubmit={(event) => {
          event.preventDefault();
          submitMessage();
        }}
      >
        <textarea
          bind:value={inputValue}
          rows="3"
          placeholder="Ask about the selected tabs..."
        ></textarea>

        <div class="composer-actions">
          <p class="hint">
            {selectedTabs.length
              ? `${selectedTabs.length} tab${selectedTabs.length > 1 ? 's' : ''} ready`
              : 'Select at least one supported tab'}
          </p>

          <div class="composer-buttons">
            {#if isSending}
              <button type="button" class="secondary-button" onclick={stopStreaming}>
                Stop
              </button>
            {/if}
            <button type="submit" class="primary-button" disabled={!canSend}>
              Send
            </button>
          </div>
        </div>
      </form>
    </section>
  </main>
</div>

<style>
  .sidepanel-container {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .sidepanel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 14px 16px;
    border-bottom: 1px solid var(--divider-color);
    background: var(--bg-primary);
    flex-shrink: 0;
  }

  .header-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 15px;
    font-weight: 700;
    color: var(--text-primary);
  }

  .header-subtitle {
    margin-top: 2px;
    font-size: 11px;
    font-weight: 500;
    color: var(--text-secondary);
  }

  .logo {
    width: 20px;
    height: 20px;
    color: var(--accent-color);
  }

  .sidepanel-content {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 12px;
  }

  .panel-card {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 14px;
    border: 1px solid var(--divider-color);
    border-radius: var(--radius-lg);
    background: linear-gradient(180deg, var(--bg-primary), var(--bg-secondary));
    box-shadow: var(--shadow-sm);
  }

  .chat-card {
    flex: 1;
    min-height: 0;
  }

  .section-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .section-heading h2 {
    font-size: 13px;
    font-weight: 700;
    color: var(--text-primary);
  }

  .hint {
    font-size: 11px;
    color: var(--text-secondary);
  }

  .hint.success {
    color: var(--success-color);
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .field span {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .field input,
  .field select,
  .composer textarea {
    width: 100%;
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    background: var(--bg-primary);
    color: var(--text-primary);
    padding: 10px 12px;
    font: inherit;
    outline: none;
    transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
  }

  .field input:focus,
  .field select:focus,
  .composer textarea:focus {
    border-color: var(--accent-color);
    box-shadow: 0 0 0 3px var(--bg-selected);
  }

  .settings-actions,
  .composer-actions,
  .composer-buttons {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .refresh-button,
  .primary-button,
  .secondary-button {
    border: none;
    border-radius: var(--radius-pill);
    padding: 9px 12px;
    font: inherit;
    font-weight: 700;
    cursor: pointer;
    transition: transform var(--transition-fast), opacity var(--transition-fast), background var(--transition-fast);
  }

  .refresh-button,
  .secondary-button {
    background: var(--bg-secondary);
    color: var(--text-primary);
  }

  .primary-button {
    background: var(--accent-color);
    color: white;
  }

  .refresh-button:hover,
  .primary-button:hover,
  .secondary-button:hover {
    transform: translateY(-1px);
  }

  .primary-button:disabled,
  .secondary-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }

  .tab-list,
  .summary-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .tab-option {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    width: 100%;
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    background: var(--bg-primary);
    padding: 10px 12px;
    text-align: left;
    color: inherit;
    cursor: pointer;
    transition: border-color var(--transition-fast), background var(--transition-fast);
  }

  .tab-option:hover {
    border-color: var(--accent-color);
    background: var(--bg-hover);
  }

  .tab-option.selected {
    border-color: var(--accent-color);
    background: var(--bg-selected);
  }

  .tab-option.disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }

  .tab-option-main,
  .summary-item {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  .tab-option-title,
  .summary-item strong {
    font-size: 12px;
    font-weight: 700;
    color: var(--text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .tab-option-host,
  .summary-item span,
  .tab-option-meta {
    font-size: 11px;
    color: var(--text-secondary);
  }

  .banner {
    border-radius: var(--radius-md);
    padding: 10px 12px;
    font-size: 12px;
  }

  .banner.error {
    background: rgba(255, 59, 48, 0.12);
    color: var(--danger-color);
  }

  .banner.status {
    background: var(--bg-secondary);
    color: var(--text-secondary);
  }

  .messages {
    flex: 1;
    min-height: 220px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding-right: 2px;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 220px;
    padding: 24px;
    text-align: center;
    border: 1px dashed var(--divider-color);
    border-radius: var(--radius-lg);
  }

  .empty-icon {
    width: 48px;
    height: 48px;
    color: var(--text-tertiary);
    margin-bottom: 8px;
  }

  .empty-icon svg {
    width: 100%;
    height: 100%;
  }

  .empty-state h3 {
    font-size: 15px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .empty-state p {
    font-size: 13px;
    color: var(--text-secondary);
    max-width: 240px;
    line-height: 1.5;
  }

  .message-row {
    display: flex;
  }

  .message-row.user {
    justify-content: flex-end;
  }

  .message-bubble {
    max-width: 88%;
    border-radius: 16px;
    padding: 10px 12px;
    background: var(--bg-secondary);
    color: var(--text-primary);
    box-shadow: var(--shadow-sm);
  }

  .message-bubble.user {
    background: var(--accent-color);
    color: white;
  }

  .message-role {
    margin-bottom: 4px;
    font-size: 10px;
    font-weight: 700;
    opacity: 0.72;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .message-bubble p {
    white-space: pre-wrap;
    word-break: break-word;
    line-height: 1.5;
  }

  .citation-list,
  .missing-info {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-top: 10px;
    padding-top: 8px;
    border-top: 1px solid rgba(255, 255, 255, 0.18);
  }

  .message-bubble:not(.user) .citation-list,
  .message-bubble:not(.user) .missing-info {
    border-top-color: var(--divider-color);
  }

  .citation-item {
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 11px;
    line-height: 1.4;
  }

  .citation-item strong,
  .missing-info strong {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    opacity: 0.7;
  }

  .citation-item span,
  .missing-info span {
    opacity: 0.92;
  }

  .composer {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding-top: 4px;
    border-top: 1px solid var(--divider-color);
  }

  .composer textarea {
    min-height: 88px;
    resize: vertical;
  }

  @media (max-width: 420px) {
    .sidepanel-header,
    .panel-card {
      padding-left: 12px;
      padding-right: 12px;
    }

    .message-bubble {
      max-width: 94%;
    }
  }
</style>
