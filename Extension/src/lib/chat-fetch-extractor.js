import { Readability } from '@mozilla/readability';

const FETCH_EXTRACTOR_DEBUG_PREFIX = '[TabDog Chat][FetchExtractor]';
const MAX_CONTENT_CHARS = 24000;
const MIN_CONTENT_CHARS = 120;
const EXCERPT_LENGTH = 280;

function logFetchExtractor(label, payload) {
  if (payload === undefined) {
    console.log(`${FETCH_EXTRACTOR_DEBUG_PREFIX} ${label}`);
    return;
  }

  console.log(`${FETCH_EXTRACTOR_DEBUG_PREFIX} ${label}`, payload);
}

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
  if (excerpt.length <= EXCERPT_LENGTH) {
    return excerpt;
  }

  return `${excerpt.slice(0, EXCERPT_LENGTH).trim()}...`;
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

function buildDocument(html, url) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const base = doc.createElement('base');
  base.setAttribute('href', url);
  doc.head.prepend(base);
  return doc;
}

function parseWithReadability(doc, titleHint, url) {
  const article = new Readability(doc).parse();
  const content = normalizeWhitespace(article?.textContent || '');

  if (content.length < MIN_CONTENT_CHARS) {
    return null;
  }

  return {
    title: normalizeWhitespace(article?.title || titleHint || ''),
    url,
    siteName: normalizeWhitespace(article?.siteName || new URL(url).hostname || ''),
    excerpt: buildExcerpt(article?.excerpt || content),
    content,
    strategy: 'fetch-readability',
  };
}

function parseWithFallback(doc, titleHint, url) {
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

  let root = doc.body;

  for (const selector of selectors) {
    const element = doc.querySelector(selector);
    if (element) {
      root = element;
      break;
    }
  }

  const content = normalizeWhitespace(root?.textContent || '');
  if (content.length < MIN_CONTENT_CHARS) {
    throw new Error('Fetched HTML did not contain enough readable text.');
  }

  return {
    title: normalizeWhitespace(doc.title || titleHint || ''),
    url,
    siteName: normalizeWhitespace(new URL(url).hostname || ''),
    excerpt: buildExcerpt(content),
    content,
    strategy: root === doc.body ? 'fetch-textContent' : 'fetch-semantic-fallback',
  };
}

export async function extractTabContentByFetch(tab) {
  logFetchExtractor('Starting fetch extraction', {
    tabId: tab.id,
    title: tab.title,
    url: tab.url,
  });

  const response = await fetch(tab.url, {
    method: 'GET',
    credentials: 'include',
    redirect: 'follow',
    cache: 'no-store',
    headers: {
      Accept: 'text/html,application/xhtml+xml',
    },
  });

  const contentType = response.headers.get('content-type') || '';
  logFetchExtractor('Fetch response received', {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    url: response.url,
    contentType,
  });

  if (!response.ok) {
    throw new Error(`Fetch extraction failed with status ${response.status}.`);
  }

  if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
    throw new Error(`Unsupported content type for fetch extraction: ${contentType || 'unknown'}`);
  }

  const html = await response.text();
  logFetchExtractor('Fetched HTML', {
    url: response.url || tab.url,
    htmlLength: html.length,
    preview: html.slice(0, 400),
  });

  const doc = buildDocument(html, response.url || tab.url);
  const parsed = parseWithReadability(doc, tab.title, response.url || tab.url)
    || parseWithFallback(doc, tab.title, response.url || tab.url);

  const truncated = truncateContent(parsed.content);

  const result = {
    ok: true,
    tabId: tab.id,
    title: parsed.title || tab.title || 'Untitled Tab',
    url: parsed.url || tab.url || '',
    siteName: parsed.siteName || '',
    excerpt: parsed.excerpt || '',
    strategy: parsed.strategy,
    content: truncated.content,
    charCount: truncated.originalCharCount,
    truncated: truncated.truncated,
    truncatedCharCount: truncated.content.length,
    extractedAt: Date.now(),
  };

  logFetchExtractor('Normalized fetch extraction result', result);
  return result;
}
