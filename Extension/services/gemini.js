const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const DEFAULT_MAX_OUTPUT_TOKENS = 1024;
const MAX_HISTORY_MESSAGES = 12;

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

function parseSseEvent(rawEvent) {
  const dataLines = rawEvent
    .split('\n')
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

  return JSON.parse(payload);
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

  const endpoint = `${GEMINI_API_BASE}/models/${model}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey.trim())}`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    signal,
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: SYSTEM_PROMPT }],
      },
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: DEFAULT_MAX_OUTPUT_TOKENS,
      },
      contents: createGeminiContents(messages, tabContexts),
    }),
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
  let fullText = '';
  let usageMetadata = null;

  while (true) {
    const { value, done } = await reader.read();

    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split('\n\n');
    buffer = events.pop() || '';

    for (const event of events) {
      const payload = parseSseEvent(event);
      if (!payload) continue;

      usageMetadata = payload.usageMetadata || usageMetadata;
      const chunkText = extractChunkText(payload);
      if (!chunkText) continue;

      let delta = chunkText;
      if (chunkText.startsWith(fullText)) {
        delta = chunkText.slice(fullText.length);
      }

      if (!delta) continue;

      fullText += delta;
      onChunk?.(delta, payload);
    }
  }

  if (buffer.trim()) {
    const payload = parseSseEvent(buffer.trim());
    if (payload) {
      usageMetadata = payload.usageMetadata || usageMetadata;
      const chunkText = extractChunkText(payload);
      if (chunkText) {
        let delta = chunkText;
        if (chunkText.startsWith(fullText)) {
          delta = chunkText.slice(fullText.length);
        }

        if (delta) {
          fullText += delta;
          onChunk?.(delta, payload);
        }
      }
    }
  }

  return {
    text: fullText.trim(),
    usageMetadata,
  };
}
