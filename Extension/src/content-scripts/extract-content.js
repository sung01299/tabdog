import { Readability } from '@mozilla/readability';

const MIN_READABILITY_CHARS = 280;
const EXCERPT_LENGTH = 280;

function normalizeWhitespace(text) {
  return (text || '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function getFallbackRoot() {
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

  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element) {
      return element;
    }
  }

  return document.body;
}

function getVisibleText(element) {
  if (!element) return '';

  const text = element.innerText || element.textContent || '';
  return normalizeWhitespace(text);
}

function buildExcerpt(source) {
  const excerpt = normalizeWhitespace(source);

  if (excerpt.length <= EXCERPT_LENGTH) {
    return excerpt;
  }

  return `${excerpt.slice(0, EXCERPT_LENGTH).trim()}...`;
}

function parseWithReadability() {
  const documentClone = document.cloneNode(true);
  const article = new Readability(documentClone).parse();

  if (!article?.textContent) {
    return null;
  }

  const content = normalizeWhitespace(article.textContent);
  if (content.length < MIN_READABILITY_CHARS) {
    return null;
  }

  return {
    title: normalizeWhitespace(article.title || document.title || ''),
    siteName: normalizeWhitespace(article.siteName || location.hostname || ''),
    excerpt: buildExcerpt(article.excerpt || content),
    content,
    strategy: 'readability',
  };
}

function parseWithFallback() {
  const fallbackRoot = getFallbackRoot();
  const content = getVisibleText(fallbackRoot);

  return {
    title: normalizeWhitespace(document.title || ''),
    siteName: normalizeWhitespace(location.hostname || ''),
    excerpt: buildExcerpt(content),
    content,
    strategy: fallbackRoot === document.body ? 'innerText' : 'semantic-fallback',
  };
}

function extractPageContent() {
  try {
    const parsed = parseWithReadability() || parseWithFallback();
    const content = normalizeWhitespace(parsed.content);

    if (!content) {
      return {
        error: 'empty_content',
        message: 'No readable content was found in the page.',
      };
    }

    return {
      title: parsed.title,
      url: location.href,
      siteName: parsed.siteName,
      excerpt: parsed.excerpt,
      content,
      strategy: parsed.strategy,
      charCount: content.length,
    };
  } catch (error) {
    return {
      error: 'extract_failed',
      message: error?.message || 'Failed to parse page content.',
    };
  }
}

globalThis.__TABDOG_EXTRACT_PAGE__ = extractPageContent;
