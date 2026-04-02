const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const DEFAULT_MAX_OUTPUT_TOKENS = 1024;
const MAX_HISTORY_MESSAGES = 12;
const SSE_EVENT_SEPARATOR = /\r?\n\r?\n/;
const STREAM_START_TIMEOUT_MS = 12000;
const GEMINI_DEBUG_PREFIX = '[TabDog Chat][Gemini]';

const SYSTEM_PROMPT = `
You are TabDog Chat, an assistant that answers questions about the user's selected browser tabs.

Rules:
- Answer only from the provided evidence chunks.
- Never use outside knowledge, memory, or guesses.
- If the evidence is insufficient or ambiguous, say you cannot verify it from the selected tab content.
- When multiple tabs are involved, clearly distinguish them.
- Cite factual statements inline using the provided chunk ids like [T1-CHUNK-1].
- If a claim has no citation support, do not include it.
- Keep answers concise and useful.
`.trim();

const VERIFIER_SYSTEM_PROMPT = `
You are a strict evidence verifier for TabDog Chat.

Rules:
- You must verify the draft answer only against the provided evidence chunks.
- Remove any statement that is not directly supported by the evidence.
- If the evidence is insufficient, return an answer that clearly says the information cannot be verified from the selected tabs.
- Preserve useful supported content when possible.
- Return valid JSON only.
- Every citation must reference a provided chunk id and include a short exact quote from the evidence.
`.trim();

const EXHAUSTIVE_EXTRACTOR_SYSTEM_PROMPT = `
You are an exhaustive evidence extractor for TabDog Chat.

Rules:
- Review every provided evidence chunk carefully.
- Be recall-oriented: extract any fact that could help answer the user's question.
- Do not infer beyond the evidence.
- Return valid JSON only.
- Each finding must be directly supported by one or more chunk ids and short exact quotes.
- If nothing is relevant, return relevant=false and an empty findings array.
`.trim();

const EXHAUSTIVE_SYNTHESIS_SYSTEM_PROMPT = `
You are a grounded answer synthesizer for TabDog Chat.

Rules:
- Use only the extracted findings and evidence.
- Do not add outside knowledge or guesses.
- Combine findings from different batches into one concise answer.
- Return valid JSON only.
- Every factual statement in the answer must be backed by citations.
- If the evidence is still insufficient, say the answer cannot be fully verified from the selected tabs.
`.trim();

export const GEMINI_MODELS = [
  {
    id: 'gemini-2.5-flash',
    label: 'Gemini 2.5 Flash',
    description: 'Balanced speed and cost',
  },
  {
    id: 'gemini-2.5-pro',
    label: 'Gemini 2.5 Pro',
    description: 'Higher-quality reasoning',
  },
];

function buildEvidenceBlock(evidenceChunks) {
  return evidenceChunks
    .map((chunk) => {
      const lines = [
        `${chunk.chunkId}`,
        `Tab: ${chunk.tabLabel}`,
        `Title: ${chunk.title || 'Untitled Tab'}`,
        `URL: ${chunk.url || ''}`,
        `Extraction strategy: ${chunk.strategy || 'unknown'}`,
      ];

      if (Array.isArray(chunk.sectionPath) && chunk.sectionPath.length) {
        lines.push(`Section path: ${chunk.sectionPath.join(' > ')}`);
      }

      if (Array.isArray(chunk.blockKinds) && chunk.blockKinds.length) {
        lines.push(`Block types: ${chunk.blockKinds.join(', ')}`);
      }

      lines.push('', chunk.text || '');

      return lines.join('\n');
    })
    .join('\n\n---\n\n');
}

function buildLatestUserMessage(evidenceChunks, question) {
  return [
    'Evidence chunks from the selected tabs:',
    buildEvidenceBlock(evidenceChunks),
    '',
    'User question:',
    question,
    '',
    'Answer requirements:',
    '- Use only the evidence above.',
    '- Cite the supporting chunk ids inline.',
    '- If the evidence does not support an answer, say so clearly.',
  ].join('\n');
}

function buildVerificationMessage(evidenceChunks, question, draftAnswer) {
  return [
    'Evidence chunks from the selected tabs:',
    buildEvidenceBlock(evidenceChunks),
    '',
    'User question:',
    question,
    '',
    'Draft answer to verify:',
    draftAnswer,
    '',
    'Return JSON with this shape:',
    '{',
    '  "supported": true,',
    '  "answer": "verified answer here",',
    '  "citations": [',
    '    {',
    '      "chunkId": "T1-CHUNK-1",',
    '      "quote": "exact supporting quote",',
    '      "reason": "what this quote supports"',
    '    }',
    '  ],',
    '  "unsupportedClaims": ["claim removed because unsupported"],',
    '  "missingInformation": ["what is missing if needed"]',
    '}',
    '',
    'Rules:',
    '- Use only the evidence.',
    '- If unsupported, set supported to false.',
    '- Citations must be exact short quotes from the evidence, max 180 characters each.',
    '- If a statement has no support, remove it from answer and mention it in unsupportedClaims.',
  ].join('\n');
}

function buildExhaustiveBatchMessage(evidenceChunks, question) {
  return [
    'Evidence chunks from one exhaustive sweep batch:',
    buildEvidenceBlock(evidenceChunks),
    '',
    'User question:',
    question,
    '',
    'Return JSON with this shape:',
    '{',
    '  "relevant": true,',
    '  "findings": [',
    '    {',
    '      "statement": "supported fact or candidate answer fragment",',
    '      "chunkIds": ["T1-CHUNK-1"],',
    '      "quotes": ["exact supporting quote"],',
    '      "reason": "why this matters to the question"',
    '    }',
    '  ],',
    '  "missingInformation": []',
    '}',
    '',
    'Rules:',
    '- Extract any supported fact that may help answer the question.',
    '- Be conservative but high recall.',
    '- If nothing is relevant, return relevant=false.',
  ].join('\n');
}

function buildExhaustiveSynthesisMessage(question, findings) {
  return [
    'User question:',
    question,
    '',
    'Verified findings collected from many evidence batches:',
    JSON.stringify(findings, null, 2),
    '',
    'Return JSON with this shape:',
    '{',
    '  "supported": true,',
    '  "answer": "final grounded answer",',
    '  "citations": [',
    '    {',
    '      "chunkId": "T1-CHUNK-1",',
    '      "quote": "exact supporting quote",',
    '      "reason": "what this quote supports"',
    '    }',
    '  ],',
    '  "unsupportedClaims": [],',
    '  "missingInformation": []',
    '}',
    '',
    'Rules:',
    '- Use only the supplied findings.',
    '- If a point is not in findings, do not include it.',
    '- Citations must cite the supporting chunk ids and exact quotes.',
  ].join('\n');
}

function createGeminiContents(messages, evidenceChunks) {
  const trimmedMessages = messages.slice(-MAX_HISTORY_MESSAGES);
  const lastUserIndex = [...trimmedMessages]
    .map((message) => message.role)
    .lastIndexOf('user');

  if (lastUserIndex === -1) {
    throw new Error('A user message is required before calling Gemini.');
  }

  return trimmedMessages.map((message, index) => {
    const text =
      index === lastUserIndex
        ? buildLatestUserMessage(evidenceChunks, message.content)
        : message.content;

    return {
      role: message.role === 'assistant' ? 'model' : 'user',
      parts: [{ text }],
    };
  });
}

function extractChunkText(payload) {
  const candidates = payload?.candidates || [];
  return candidates
    .flatMap((candidate) => candidate?.content?.parts || [])
    .map((part) => part?.text || '')
    .join('');
}

async function parseErrorResponse(response) {
  try {
    const data = await response.json();
    return data?.error?.message || `Gemini request failed with status ${response.status}.`;
  } catch {
    return `Gemini request failed with status ${response.status}.`;
  }
}

function buildRequestBody(messages, evidenceChunks) {
  return {
    systemInstruction: {
      parts: [{ text: SYSTEM_PROMPT }],
    },
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: DEFAULT_MAX_OUTPUT_TOKENS,
    },
    contents: createGeminiContents(messages, evidenceChunks),
  };
}

function logGeminiDebug(label, payload) {
  if (payload === undefined) {
    console.log(`${GEMINI_DEBUG_PREFIX} ${label}`);
    return;
  }

  console.log(`${GEMINI_DEBUG_PREFIX} ${label}`, payload);
}

function extractResponseText(payload) {
  return extractChunkText(payload).trim();
}

function extractJsonText(payload) {
  const text = extractResponseText(payload);
  if (!text) {
    return '';
  }

  const fencedMatch = text.match(/```json\s*([\s\S]*?)```/i);
  if (fencedMatch) {
    return fencedMatch[1].trim();
  }

  const objectMatch = text.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    return objectMatch[0].trim();
  }

  return text.trim();
}

function normalizeVerificationResult(result, fallbackAnswer) {
  const citations = Array.isArray(result?.citations)
    ? result.citations
        .filter((citation) => citation?.chunkId && citation?.quote)
        .map((citation) => ({
          chunkId: String(citation.chunkId),
          quote: String(citation.quote).trim(),
          reason: citation.reason ? String(citation.reason).trim() : '',
        }))
    : [];

  return {
    supported: Boolean(result?.supported),
    answer: (result?.answer || fallbackAnswer || '').trim(),
    citations,
    unsupportedClaims: Array.isArray(result?.unsupportedClaims)
      ? result.unsupportedClaims.map((claim) => String(claim).trim()).filter(Boolean)
      : [],
    missingInformation: Array.isArray(result?.missingInformation)
      ? result.missingInformation.map((item) => String(item).trim()).filter(Boolean)
      : [],
  };
}

function normalizeBatchFindings(result) {
  const findings = Array.isArray(result?.findings)
    ? result.findings
        .map((finding) => ({
          statement: String(finding?.statement || '').trim(),
          chunkIds: Array.isArray(finding?.chunkIds)
            ? finding.chunkIds.map((id) => String(id).trim()).filter(Boolean)
            : [],
          quotes: Array.isArray(finding?.quotes)
            ? finding.quotes.map((quote) => String(quote).trim()).filter(Boolean)
            : [],
          reason: String(finding?.reason || '').trim(),
        }))
        .filter((finding) => finding.statement && finding.chunkIds.length > 0)
    : [];

  return {
    relevant: Boolean(result?.relevant) && findings.length > 0,
    findings,
    missingInformation: Array.isArray(result?.missingInformation)
      ? result.missingInformation.map((item) => String(item).trim()).filter(Boolean)
      : [],
  };
}

function linkAbortSignal(sourceSignal, targetController) {
  if (!sourceSignal) {
    return () => {};
  }

  if (sourceSignal.aborted) {
    targetController.abort(sourceSignal.reason);
    return () => {};
  }

  const handleAbort = () => {
    targetController.abort(sourceSignal.reason);
  };

  sourceSignal.addEventListener('abort', handleAbort, { once: true });
  return () => {
    sourceSignal.removeEventListener('abort', handleAbort);
  };
}

function parseSseEvent(rawEvent) {
  const dataLines = rawEvent
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trim());

  if (!dataLines.length) {
    return null;
  }

  const payload = dataLines.join('\n');
  if (!payload || payload === '[DONE]') {
    return null;
  }

  try {
    return JSON.parse(payload);
  } catch (error) {
    throw new Error('Failed to parse the Gemini streaming response.');
  }
}

function applySseEvent(rawEvent, state, onChunk) {
  const payload = parseSseEvent(rawEvent);
  if (!payload) {
    return;
  }

  state.usageMetadata = payload.usageMetadata || state.usageMetadata;
  const chunkText = extractChunkText(payload);
  if (!chunkText) {
    return;
  }

  let delta = chunkText;
  if (chunkText.startsWith(state.fullText)) {
    delta = chunkText.slice(state.fullText.length);
  }

  if (!delta) {
    return;
  }

  state.receivedChunk = true;
  state.fullText += delta;
  onChunk?.(delta, payload);
}

async function generateTabChat({
  apiKey,
  model,
  messages,
  evidenceChunks,
  signal,
}) {
  const endpoint = `${GEMINI_API_BASE}/models/${model}:generateContent`;
  const requestBody = buildRequestBody(messages, evidenceChunks);

  logGeminiDebug('Fallback request start', {
    endpoint,
    model,
    requestBody,
    apiKey: '[REDACTED]',
  });

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey.trim(),
    },
    signal,
    body: JSON.stringify(requestBody),
  });

  logGeminiDebug('Fallback response status', {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
  });

  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }

  const payload = await response.json();
  const text = extractResponseText(payload);

  logGeminiDebug('Fallback response payload', payload);
  logGeminiDebug('Fallback extracted text', text);

  if (!text) {
    throw new Error('Gemini returned an empty response.');
  }

  return {
    text,
    usageMetadata: payload?.usageMetadata || null,
  };
}

async function generateJsonContent({
  apiKey,
  model,
  systemPrompt,
  userText,
  signal,
  maxOutputTokens = 1600,
  debugLabel = 'JSON generation',
}) {
  const endpoint = `${GEMINI_API_BASE}/models/${model}:generateContent`;
  const requestBody = {
    systemInstruction: {
      parts: [{ text: systemPrompt }],
    },
    generationConfig: {
      temperature: 0,
      maxOutputTokens,
      responseMimeType: 'application/json',
    },
    contents: [
      {
        role: 'user',
        parts: [{ text: userText }],
      },
    ],
  };

  logGeminiDebug(`${debugLabel} request`, {
    endpoint,
    model,
    requestBody,
    apiKey: '[REDACTED]',
  });

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey.trim(),
    },
    signal,
    body: JSON.stringify(requestBody),
  });

  logGeminiDebug(`${debugLabel} status`, {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
  });

  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }

  const payload = await response.json();
  logGeminiDebug(`${debugLabel} payload`, payload);

  const jsonText = extractJsonText(payload);
  if (!jsonText) {
    throw new Error(`${debugLabel} returned an empty response.`);
  }

  try {
    return JSON.parse(jsonText);
  } catch (error) {
    throw new Error(`${debugLabel} returned invalid JSON.`);
  }
}

export async function extractBatchFindings({
  apiKey,
  model,
  question,
  evidenceChunks,
  signal,
}) {
  const parsed = await generateJsonContent({
    apiKey,
    model,
    systemPrompt: EXHAUSTIVE_EXTRACTOR_SYSTEM_PROMPT,
    userText: buildExhaustiveBatchMessage(evidenceChunks, question),
    signal,
    maxOutputTokens: 1400,
    debugLabel: 'Exhaustive batch extractor',
  });

  const normalized = normalizeBatchFindings(parsed);
  logGeminiDebug('Exhaustive batch normalized findings', normalized);
  return normalized;
}

export async function synthesizeExhaustiveAnswer({
  apiKey,
  model,
  question,
  findings,
  signal,
}) {
  const parsed = await generateJsonContent({
    apiKey,
    model,
    systemPrompt: EXHAUSTIVE_SYNTHESIS_SYSTEM_PROMPT,
    userText: buildExhaustiveSynthesisMessage(question, findings),
    signal,
    maxOutputTokens: 1600,
    debugLabel: 'Exhaustive synthesis',
  });

  const normalized = normalizeVerificationResult(parsed, '');
  logGeminiDebug('Exhaustive synthesis normalized result', normalized);
  return normalized;
}

export async function verifyTabAnswer({
  apiKey,
  model,
  question,
  draftAnswer,
  evidenceChunks,
  signal,
}) {
  const parsed = await generateJsonContent({
    apiKey,
    model,
    systemPrompt: VERIFIER_SYSTEM_PROMPT,
    userText: buildVerificationMessage(evidenceChunks, question, draftAnswer),
    signal,
    maxOutputTokens: 1400,
    debugLabel: 'Verifier',
  });
  const normalized = normalizeVerificationResult(parsed, draftAnswer);
  logGeminiDebug('Verifier normalized result', normalized);
  return normalized;
}

export async function streamTabChat({
  apiKey,
  model,
  messages,
  evidenceChunks,
  signal,
  onChunk,
}) {
  if (!apiKey?.trim()) {
    throw new Error('A Gemini API key is required.');
  }

  const endpoint = `${GEMINI_API_BASE}/models/${model}:streamGenerateContent?alt=sse`;
  const requestBody = buildRequestBody(messages, evidenceChunks);
  const streamController = new AbortController();
  const unlinkAbort = linkAbortSignal(signal, streamController);

  let streamTimedOut = false;
  let receivedChunk = false;
  const startupTimer = setTimeout(() => {
    streamTimedOut = true;
    streamController.abort(new DOMException('Streaming startup timeout', 'AbortError'));
  }, STREAM_START_TIMEOUT_MS);

  try {
    logGeminiDebug('Streaming request start', {
      endpoint,
      model,
      requestBody,
      apiKey: '[REDACTED]',
    });

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey.trim(),
      },
      signal: streamController.signal,
      body: JSON.stringify(requestBody),
    });

    logGeminiDebug('Streaming response status', {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
    });

    if (!response.ok) {
      throw new Error(await parseErrorResponse(response));
    }

    if (!response.body) {
      throw new Error('Gemini returned an empty streaming response.');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    const streamState = {
      fullText: '',
      usageMetadata: null,
      receivedChunk: false,
    };

    while (true) {
      const { value, done } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split(SSE_EVENT_SEPARATOR);
      buffer = events.pop() || '';

      for (const event of events) {
        logGeminiDebug('Streaming raw event', event);
        applySseEvent(event, streamState, onChunk);
      }

      if (streamState.receivedChunk) {
        receivedChunk = true;
        clearTimeout(startupTimer);
      }
    }

    if (buffer.trim()) {
      logGeminiDebug('Streaming trailing event', buffer.trim());
      applySseEvent(buffer.trim(), streamState, onChunk);
      if (streamState.receivedChunk) {
        receivedChunk = true;
      }
    }

    if (!streamState.fullText.trim()) {
      throw new Error('Gemini returned an empty response.');
    }

    logGeminiDebug('Streaming final text', streamState.fullText);
    logGeminiDebug('Streaming usage metadata', streamState.usageMetadata);

    return {
      text: streamState.fullText.trim(),
      usageMetadata: streamState.usageMetadata,
    };
  } catch (error) {
    logGeminiDebug('Streaming request failed', {
      error,
      message: error?.message,
      streamTimedOut,
      receivedChunk,
      signalAborted: Boolean(signal?.aborted),
    });
    clearTimeout(startupTimer);
    unlinkAbort();

    if (signal?.aborted && !streamTimedOut) {
      throw error;
    }

    if (receivedChunk && !streamTimedOut) {
      throw error;
    }

    logGeminiDebug('Switching to fallback generateContent', {
      reason: streamTimedOut ? 'stream_start_timeout' : 'stream_request_failed_before_first_chunk',
    });

    const fallback = await generateTabChat({
      apiKey,
      model,
      messages,
      evidenceChunks,
      signal,
    });

    onChunk?.(fallback.text, {
      usageMetadata: fallback.usageMetadata,
      fallback: 'generateContent',
    });

    return fallback;
  } finally {
    clearTimeout(startupTimer);
    unlinkAbort();
  }
}
