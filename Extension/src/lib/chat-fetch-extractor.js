import { Readability } from '@mozilla/readability';

const FETCH_EXTRACTOR_DEBUG_PREFIX = '[TabDog Chat][FetchExtractor]';
const MIN_CONTENT_CHARS = 120;
const EXCERPT_LENGTH = 280;
const SKIP_TAGS = new Set(['script', 'style', 'noscript', 'svg', 'iframe']);

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

function pushBlock(blocks, block) {
  const text = normalizeWhitespace(block?.text || '');
  if (!text) return;

  blocks.push({
    type: block.type || 'paragraph',
    text,
    headingLevel: block.headingLevel || null,
    headingText: block.headingText || '',
  });
}

function serializeTable(table) {
  const rows = [...table.querySelectorAll('tr')]
    .map((row) =>
      [...row.querySelectorAll('th, td')]
        .map((cell) => normalizeWhitespace(cell.textContent || ''))
        .filter(Boolean),
    )
    .filter((cells) => cells.length > 0);

  if (!rows.length) {
    return '';
  }

  return rows.map((cells) => `| ${cells.join(' | ')} |`).join('\n');
}

function serializeList(list, depth = 0) {
  const lines = [];
  const isOrdered = list.tagName.toLowerCase() === 'ol';

  [...list.children].forEach((item, index) => {
    if (item.tagName?.toLowerCase() !== 'li') return;

    const nestedLists = [...item.querySelectorAll(':scope > ul, :scope > ol')];
    const clone = item.cloneNode(true);
    clone.querySelectorAll('ul, ol').forEach((nested) => nested.remove());
    const itemText = normalizeWhitespace(clone.textContent || '');

    if (itemText) {
      const prefix = isOrdered ? `${index + 1}.` : '-';
      lines.push(`${'  '.repeat(depth)}${prefix} ${itemText}`);
    }

    nestedLists.forEach((nested) => {
      const nestedText = serializeList(nested, depth + 1);
      if (nestedText) {
        lines.push(nestedText);
      }
    });
  });

  return lines.join('\n');
}

function serializeBlockquote(blockquote) {
  return normalizeWhitespace(
    (blockquote.textContent || '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => `> ${line}`)
      .join('\n'),
  );
}

function serializeCodeBlock(pre) {
  const codeText = (pre.innerText || pre.textContent || '').trim();
  if (!codeText) {
    return '';
  }

  return `\`\`\`\n${codeText}\n\`\`\``;
}

function collectStructuredBlocks(node, blocks) {
  if (!node) return;

  if (node.nodeType === Node.TEXT_NODE) {
    return;
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return;
  }

  const tag = node.tagName.toLowerCase();
  if (SKIP_TAGS.has(tag)) {
    return;
  }

  if (/^h[1-6]$/.test(tag)) {
    const headingLevel = Number(tag[1]);
    const headingText = normalizeWhitespace(node.textContent || '');
    pushBlock(blocks, {
      type: 'heading',
      headingLevel,
      headingText,
      text: `${'#'.repeat(headingLevel)} ${headingText}`,
    });
    return;
  }

  if (tag === 'p') {
    pushBlock(blocks, {
      type: 'paragraph',
      text: node.textContent || '',
    });
    return;
  }

  if (tag === 'pre') {
    pushBlock(blocks, {
      type: 'code',
      text: serializeCodeBlock(node),
    });
    return;
  }

  if (tag === 'table') {
    pushBlock(blocks, {
      type: 'table',
      text: serializeTable(node),
    });
    return;
  }

  if (tag === 'ul' || tag === 'ol') {
    pushBlock(blocks, {
      type: 'list',
      text: serializeList(node),
    });
    return;
  }

  if (tag === 'blockquote') {
    pushBlock(blocks, {
      type: 'blockquote',
      text: serializeBlockquote(node),
    });
    return;
  }

  const children = [...node.children];
  if (!children.length) {
    if (['div', 'section', 'article', 'main'].includes(tag)) {
      pushBlock(blocks, {
        type: 'paragraph',
        text: node.textContent || '',
      });
    }
    return;
  }

  children.forEach((child) => collectStructuredBlocks(child, blocks));
}

function blocksToContent(blocks) {
  return blocks
    .map((block) => block.text)
    .filter(Boolean)
    .join('\n\n')
    .trim();
}

function buildStructuredBlocksFromRoot(root) {
  const blocks = [];
  collectStructuredBlocks(root, blocks);

  return {
    blocks,
    content: blocksToContent(blocks),
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
  const rawContent = normalizeWhitespace(article?.textContent || '');
  const articleDoc = article?.content
    ? buildDocument(`<article>${article.content}</article>`, url)
    : null;
  const articleRoot = articleDoc?.querySelector('article') || null;
  const structured = articleRoot
    ? buildStructuredBlocksFromRoot(articleRoot)
    : { blocks: [], content: rawContent };
  const content = rawContent;

  if (content.length < MIN_CONTENT_CHARS) {
    return null;
  }

  return {
    title: normalizeWhitespace(article?.title || titleHint || ''),
    url,
    siteName: normalizeWhitespace(article?.siteName || new URL(url).hostname || ''),
    excerpt: buildExcerpt(article?.excerpt || content),
    content,
    structuredContent: structured.content,
    blocks: structured.blocks,
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

  const rawContent = normalizeWhitespace(root?.textContent || '');
  if (rawContent.length < MIN_CONTENT_CHARS) {
    throw new Error('Fetched HTML did not contain enough readable text.');
  }

  const structured = buildStructuredBlocksFromRoot(root);
  const structuredContent = structured.content || rawContent;

  return {
    title: normalizeWhitespace(doc.title || titleHint || ''),
    url,
    siteName: normalizeWhitespace(new URL(url).hostname || ''),
    excerpt: buildExcerpt(structuredContent),
    content: rawContent,
    structuredContent,
    blocks: structured.blocks,
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

  const result = {
    ok: true,
    tabId: tab.id,
    title: parsed.title || tab.title || 'Untitled Tab',
    url: parsed.url || tab.url || '',
    siteName: parsed.siteName || '',
    excerpt: parsed.excerpt || '',
    strategy: parsed.strategy,
    content: parsed.content,
    structuredContent: parsed.structuredContent || parsed.content,
    blocks: parsed.blocks || [],
    charCount: parsed.content.length,
    truncated: false,
    truncatedCharCount: parsed.content.length,
    extractedAt: Date.now(),
  };

  logFetchExtractor('Normalized fetch extraction result', result);
  return result;
}
