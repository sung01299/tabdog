/*
 * LEGACY NOTICE:
 * This background/content-script extraction fallback belongs to the legacy in-extension chat/RAG path.
 * The long-term plan is to replace it with backend-driven extraction.
 */
const MIN_CONTENT_CHARS = 120;
const EXTRACTOR_STEP_TIMEOUT_MS = 15000;
const EXTRACTOR_DEBUG_PREFIX = '[TabDog Chat][Extractor]';

const UNSUPPORTED_PROTOCOLS = [
  'chrome:',
  'chrome-extension:',
  'edge:',
  'about:',
  'moz-extension:',
  'brave:',
  'opera:',
  'devtools:',
  'view-source:',
];

function createError(error, message, extra = {}) {
  return {
    ok: false,
    error,
    message,
    ...extra,
  };
}

function logExtractor(label, payload) {
  if (payload === undefined) {
    console.log(`${EXTRACTOR_DEBUG_PREFIX} ${label}`);
    return;
  }

  console.log(`${EXTRACTOR_DEBUG_PREFIX} ${label}`, payload);
}

function withTimeout(promise, label, timeoutMs = EXTRACTOR_STEP_TIMEOUT_MS) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`${label} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    }),
  ]);
}

function isSupportedTabUrl(url) {
  if (!url) return false;

  if (UNSUPPORTED_PROTOCOLS.some((protocol) => url.startsWith(protocol))) {
    return false;
  }

  return /^https?:\/\//.test(url);
}

function mapInjectionError(error, tab) {
  const message = error?.message || String(error);

  if (message.includes('Missing host permission')) {
    return createError(
      'permission_required',
      'TabDog needs site access for this page before it can read the content.',
      { tabId: tab?.id, url: tab?.url || '' },
    );
  }

  if (
    message.includes('The extensions gallery cannot be scripted') ||
    message.includes('Cannot access contents of url') ||
    message.includes('Frame with ID 0 is showing error page')
  ) {
    return createError(
      'unsupported_url',
      'This page cannot be analyzed by TabDog Chat.',
      { tabId: tab?.id, url: tab?.url || '' },
    );
  }

  return createError(
    'injection_failed',
    'TabDog could not inject the extractor into this page.',
    {
      tabId: tab?.id,
      url: tab?.url || '',
      details: message,
    },
  );
}

async function runInlineFallbackExtractor(tabId) {
  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      const selectors = [
        'article',
        'main',
        '[role="main"]',
        '#main',
        '#content',
        '.main',
        '.content',
        '.post-content',
        '.entry-content',
        '.article-content',
      ];

      function normalizeWhitespace(text) {
        return (text || '')
          .replace(/\u00a0/g, ' ')
          .replace(/[ \t]+\n/g, '\n')
          .replace(/\n{3,}/g, '\n\n')
          .replace(/[ \t]{2,}/g, ' ')
          .trim();
      }

      function buildExcerpt(source) {
        const excerpt = normalizeWhitespace(source);
        if (excerpt.length <= 280) {
          return excerpt;
        }
        return `${excerpt.slice(0, 280).trim()}...`;
      }

      function getFallbackRoot() {
        for (const selector of selectors) {
          const element = document.querySelector(selector);
          if (element) {
            return element;
          }
        }
        return document.body;
      }

      const root = getFallbackRoot();
      const content = normalizeWhitespace(root?.innerText || root?.textContent || '');
      if (!content) {
        return {
          error: 'empty_content',
          message: 'No readable content was found in the fallback extractor.',
        };
      }

      return {
        title: normalizeWhitespace(document.title || ''),
        url: location.href,
        siteName: normalizeWhitespace(location.hostname || ''),
        excerpt: buildExcerpt(content),
        content,
        strategy: root === document.body ? 'inline-innerText' : 'inline-semantic-fallback',
        charCount: content.length,
      };
    },
  });

  return result?.result || null;
}

export async function extractTabContent(tabId) {
  logExtractor('extractTabContent called', { tabId });

  if (!Number.isInteger(tabId)) {
    return createError('invalid_tab', 'A valid tab id is required.');
  }

  let tab;

  try {
    tab = await chrome.tabs.get(tabId);
    logExtractor('Resolved tab', {
      tabId,
      title: tab.title,
      url: tab.url,
    });
  } catch {
    return createError('tab_not_found', 'The selected tab is no longer available.', { tabId });
  }

  if (!isSupportedTabUrl(tab.url)) {
    return createError(
      'unsupported_url',
      'Only regular http(s) pages can be analyzed by TabDog Chat.',
      { tabId, url: tab.url || '' },
    );
  }

  try {
    logExtractor('Running inline extractor directly', { tabId });
    const extraction = await withTimeout(
      runInlineFallbackExtractor(tabId),
      'runInlineFallbackExtractor',
    );
    logExtractor('Inline extractor raw result', extraction);

    if (!extraction || extraction.error) {
      const extractorError = createError(
        extraction?.error || 'empty_content',
        extraction?.message || 'Inline extractor returned no content.',
        { tabId, url: tab.url || '' },
      );
      logExtractor('Inline extractor failed', extractorError);
      return extractorError;
    }

    const rawContent = typeof extraction.content === 'string' ? extraction.content.trim() : '';

    if (rawContent.length < MIN_CONTENT_CHARS) {
      return createError(
        'empty_content',
        'This page does not contain enough readable text yet.',
        { tabId, url: tab.url || '' },
      );
    }

    const successResult = {
      ok: true,
      tabId,
      title: extraction.title || tab.title || 'Untitled Tab',
      url: extraction.url || tab.url || '',
      siteName: extraction.siteName || '',
      excerpt: extraction.excerpt || '',
      strategy: extraction.strategy || 'unknown',
      content: rawContent,
      charCount: rawContent.length,
      truncated: false,
      truncatedCharCount: rawContent.length,
      extractedAt: Date.now(),
    };

    logExtractor('Normalized extraction result', successResult);
    return successResult;
  } catch (error) {
    const mappedError = mapInjectionError(error, tab);
    logExtractor('Extraction threw error', {
      error,
      mappedError,
    });
    return mappedError;
  }
}
