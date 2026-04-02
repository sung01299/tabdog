const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const DEFAULT_MAX_OUTPUT_TOKENS = 1024;
const MAX_HISTORY_MESSAGES = 12;
const SSE_EVENT_SEPARATOR = /\r?\n\r?\n/;
const STREAM_START_TIMEOUT_MS = 12000;
const GEMINI_DEBUG_PREFIX = '[TabDog Chat][Gemini]';

const SYSTEM_PROMPT = `
You are TabDog Chat, an assistant that answers questions about the user's selected browser tabs.

Rules:
- Base your answer on the provided tab content first.
- If the tab content is missing or insufficient, say what is missing instead of guessing.
- When multiple tabs are provided, compare or combine them clearly and mention which tab you are referring to.
- Keep answers concise and useful.
- Do not claim you visited links or pages outside the supplied tab context.
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

function buildTabContextBlock(tabContexts) {
  return tabContexts
    .map((tab, index) => {
      const lines = [
        `Tab ${index + 1}: ${tab.title || 'Untitled Tab'}`,
        `URL: ${tab.url || ''}`,
        `Extraction strategy: ${tab.strategy || 'unknown'}`,
      ];

      if (tab.excerpt) {
        lines.push(`Excerpt: ${tab.excerpt}`);
      }

      lines.push('', tab.content || '');
      return lines.join('\n');
    })
    .join('\n\n---\n\n');
}

function buildLatestUserMessage(tabContexts, question) {
  return [
    'Selected tab context:',
    buildTabContextBlock(tabContexts),
    '',
    'User question:',
    question,
  ].join('\n');
}

function createGeminiContents(messages, tabContexts) {
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
        ? buildLatestUserMessage(tabContexts, message.content)
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

function buildRequestBody(messages, tabContexts) {
  return {
    systemInstruction: {
      parts: [{ text: SYSTEM_PROMPT }],
    },
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: DEFAULT_MAX_OUTPUT_TOKENS,
    },
    contents: createGeminiContents(messages, tabContexts),
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
  tabContexts,
  signal,
}) {
  const endpoint = `${GEMINI_API_BASE}/models/${model}:generateContent`;
  const requestBody = buildRequestBody(messages, tabContexts);

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

export async function streamTabChat({
  apiKey,
  model,
  messages,
  tabContexts,
  signal,
  onChunk,
}) {
  if (!apiKey?.trim()) {
    throw new Error('A Gemini API key is required.');
  }

  const endpoint = `${GEMINI_API_BASE}/models/${model}:streamGenerateContent?alt=sse`;
  const requestBody = buildRequestBody(messages, tabContexts);
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
      tabContexts,
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
