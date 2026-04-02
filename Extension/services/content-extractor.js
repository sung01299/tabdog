const EXTRACTOR_BUNDLE_PATH = 'content-scripts/extractContent.js';
const MAX_CONTENT_CHARS = 24000;
const MIN_CONTENT_CHARS = 120;

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

function isSupportedTabUrl(url) {
  if (!url) return false;

  if (UNSUPPORTED_PROTOCOLS.some((protocol) => url.startsWith(protocol))) {
    return false;
  }

  return /^https?:\/\//.test(url);
}

function truncateContent(content, maxChars = MAX_CONTENT_CHARS) {
  if (content.length <= maxChars) {
    return {
      content,
      truncated: false,
      originalCharCount: content.length,
    };
  }

  const paragraphs = content.split(/\n{2,}/).map((paragraph) => paragraph.trim()).filter(Boolean);
  let result = '';

  for (const paragraph of paragraphs) {
    const candidate = result ? `${result}\n\n${paragraph}` : paragraph;
    if (candidate.length > maxChars) {
      break;
    }
    result = candidate;
  }

  if (!result) {
    result = content.slice(0, maxChars);
  }

  return {
    content: result.trim(),
    truncated: true,
    originalCharCount: content.length,
  };
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

async function injectExtractor(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: [EXTRACTOR_BUNDLE_PATH],
  });
}

async function runExtractor(tabId) {
  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      if (typeof globalThis.__TABDOG_EXTRACT_PAGE__ !== 'function') {
        return {
          error: 'extractor_unavailable',
          message: 'Extractor bundle is not available in the page context.',
        };
      }

      return globalThis.__TABDOG_EXTRACT_PAGE__();
    },
  });

  return result?.result || null;
}

export async function extractTabContent(tabId) {
  if (!Number.isInteger(tabId)) {
    return createError('invalid_tab', 'A valid tab id is required.');
  }

  let tab;

  try {
    tab = await chrome.tabs.get(tabId);
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
    await injectExtractor(tabId);
    const extraction = await runExtractor(tabId);

    if (!extraction) {
      return createError('empty_content', 'No readable content was returned from the page.', {
        tabId,
        url: tab.url || '',
      });
    }

    if (extraction.error) {
      return createError(
        extraction.error,
        extraction.message || 'The extractor failed while reading the page.',
        { tabId, url: tab.url || '' },
      );
    }

    const rawContent = typeof extraction.content === 'string' ? extraction.content.trim() : '';

    if (rawContent.length < MIN_CONTENT_CHARS) {
      return createError(
        'empty_content',
        'This page does not contain enough readable text yet.',
        { tabId, url: tab.url || '' },
      );
    }

    const truncated = truncateContent(rawContent);

    return {
      ok: true,
      tabId,
      title: extraction.title || tab.title || 'Untitled Tab',
      url: extraction.url || tab.url || '',
      siteName: extraction.siteName || '',
      excerpt: extraction.excerpt || '',
      strategy: extraction.strategy || 'unknown',
      content: truncated.content,
      charCount: truncated.originalCharCount,
      truncated: truncated.truncated,
      truncatedCharCount: truncated.content.length,
      extractedAt: Date.now(),
    };
  } catch (error) {
    return mapInjectionError(error, tab);
  }
}
