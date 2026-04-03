/*
 * LEGACY NOTICE:
 * This IndexedDB-backed document/chunk store belongs to the legacy in-extension chat/RAG path.
 * The long-term direction is to move document storage/indexing to the backend service.
 */
const DB_NAME = 'tabdog-chat-docs';
const DB_VERSION = 1;
const STORE_NAME = 'documents';
const DOC_STORE_DEBUG_PREFIX = '[TabDog Chat][DocStore]';

function logDocStore(label, payload) {
  if (payload === undefined) {
    console.log(`${DOC_STORE_DEBUG_PREFIX} ${label}`);
    return;
  }

  console.log(`${DOC_STORE_DEBUG_PREFIX} ${label}`, payload);
}

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('sessionId', 'sessionId', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB.'));
  });
}

function withStore(mode, handler) {
  return openDb().then((db) => new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);

    let result;

    transaction.oncomplete = () => {
      db.close();
      resolve(result);
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error || new Error('IndexedDB transaction failed.'));
    };
    transaction.onabort = () => {
      db.close();
      reject(transaction.error || new Error('IndexedDB transaction aborted.'));
    };

    Promise.resolve(handler(store))
      .then((value) => {
        result = value;
      })
      .catch((error) => {
        transaction.abort();
        reject(error);
      });
  }));
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB request failed.'));
  });
}

export function chunkDocumentContent(content, { maxChars = 1600, overlapChars = 220 } = {}) {
  const paragraphs = (content || '')
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  if (!paragraphs.length) {
    return [];
  }

  const chunks = [];
  let buffer = '';

  function pushBuffer() {
    const text = buffer.trim();
    if (!text) return;

    const id = `chunk-${chunks.length + 1}`;
    chunks.push({
      id,
      text,
      charCount: text.length,
    });

    if (overlapChars > 0) {
      buffer = text.slice(Math.max(0, text.length - overlapChars));
    } else {
      buffer = '';
    }
  }

  for (const paragraph of paragraphs) {
    const candidate = buffer ? `${buffer}\n\n${paragraph}` : paragraph;
    if (candidate.length > maxChars && buffer) {
      pushBuffer();
      buffer = paragraph;
      continue;
    }

    if (paragraph.length > maxChars) {
      if (buffer) {
        pushBuffer();
        buffer = '';
      }

      let offset = 0;
      while (offset < paragraph.length) {
        const slice = paragraph.slice(offset, offset + maxChars);
        chunks.push({
          id: `chunk-${chunks.length + 1}`,
          text: slice.trim(),
          charCount: slice.trim().length,
        });
        offset += Math.max(1, maxChars - overlapChars);
      }
      continue;
    }

    buffer = candidate;
  }

  if (buffer) {
    pushBuffer();
  }

  return chunks;
}

function updateHeadingPath(headingPath, block) {
  if (block.type !== 'heading' || !block.headingLevel) {
    return headingPath;
  }

  const nextPath = headingPath.slice(0, Math.max(0, block.headingLevel - 1));
  nextPath[block.headingLevel - 1] = block.headingText || block.text;
  return nextPath;
}

function chunkDocumentBlocks(blocks, { maxChars = 1800, overlapBlocks = 1 } = {}) {
  if (!Array.isArray(blocks) || blocks.length === 0) {
    return [];
  }

  const chunks = [];
  let buffer = [];
  let bufferLength = 0;
  let headingPath = [];

  function buildChunk(chunkBlocks) {
    const text = chunkBlocks.map((block) => block.text).join('\n\n').trim();
    if (!text) return;

    const sectionPath = chunkBlocks
      .find((block) => Array.isArray(block.sectionPath) && block.sectionPath.length)?.sectionPath || [];

    chunks.push({
      id: `chunk-${chunks.length + 1}`,
      index: chunks.length,
      text,
      charCount: text.length,
      sectionPath,
      blockKinds: [...new Set(chunkBlocks.map((block) => block.type))],
      source: 'structured',
    });
  }

  function flushBuffer() {
    if (!buffer.length) return;
    buildChunk(buffer);
    buffer = overlapBlocks > 0 ? buffer.slice(-overlapBlocks) : [];
    bufferLength = buffer.reduce((sum, block) => sum + block.text.length + 2, 0);
  }

  for (const rawBlock of blocks) {
    headingPath = updateHeadingPath(headingPath, rawBlock);
    const block = {
      ...rawBlock,
      sectionPath: headingPath.filter(Boolean),
    };

    const blockLength = block.text.length + 2;

    if (buffer.length && bufferLength + blockLength > maxChars) {
      flushBuffer();
    }

    if (block.text.length > maxChars) {
      const slices = chunkDocumentContent(block.text, {
        maxChars,
        overlapChars: Math.min(220, Math.floor(maxChars / 4)),
      });

      for (const slice of slices) {
        chunks.push({
          id: `chunk-${chunks.length + 1}`,
          index: chunks.length,
          text: slice.text || slice.content || '',
          charCount: slice.charCount || slice.originalCharCount || (slice.text || '').length,
          sectionPath: block.sectionPath,
          blockKinds: [block.type],
          source: 'structured',
        });
      }

      buffer = [];
      bufferLength = 0;
      continue;
    }

    buffer.push(block);
    bufferLength += blockLength;
  }

  flushBuffer();
  return chunks;
}

function buildRawChunks(content) {
  return chunkDocumentContent(content).map((chunk, index) => ({
    id: `raw-${index + 1}`,
    index,
    text: chunk.text || chunk.content || '',
    charCount: chunk.charCount || chunk.originalCharCount || (chunk.text || '').length,
    sectionPath: [],
    blockKinds: ['raw-fallback'],
    source: 'raw',
  }));
}

function mergeChunkSets(structuredChunks, rawChunks, fullContentLength, structuredContentLength) {
  if (!structuredChunks.length) {
    return rawChunks;
  }

  const coverageRatio = fullContentLength > 0
    ? structuredContentLength / fullContentLength
    : 1;

  if (coverageRatio >= 0.9) {
    return structuredChunks;
  }

  const merged = [...structuredChunks];
  for (const rawChunk of rawChunks) {
    const duplicate = structuredChunks.some((structuredChunk) =>
      structuredChunk.text === rawChunk.text ||
      structuredChunk.text.includes(rawChunk.text) ||
      rawChunk.text.includes(structuredChunk.text),
    );

    if (!duplicate) {
      merged.push({
        ...rawChunk,
        id: `chunk-${merged.length + 1}`,
        index: merged.length,
      });
    }
  }

  return merged;
}

function buildStoredDocument(sessionId, context) {
  const structuredChunks = Array.isArray(context.blocks) && context.blocks.length
    ? chunkDocumentBlocks(context.blocks)
    : [];
  const rawChunks = buildRawChunks(context.content);
  const structuredContentLength = (context.structuredContent || '').length;
  const chunks = mergeChunkSets(
    structuredChunks,
    rawChunks,
    context.content.length,
    structuredContentLength,
  );

  return {
    id: `${sessionId}:${context.tabId}:${context.url}`,
    sessionId,
    tabId: context.tabId,
    url: context.url,
    title: context.title,
    siteName: context.siteName || '',
    excerpt: context.excerpt || '',
    strategy: context.strategy || 'unknown',
    content: context.content,
    structuredContent: context.structuredContent || '',
    charCount: context.charCount || context.content.length,
    extractedAt: context.extractedAt || Date.now(),
    chunks,
  };
}

function mergeChunkEmbeddings(nextChunks, existingChunks = []) {
  return nextChunks.map((chunk) => {
    const existing = existingChunks.find((candidate) =>
      candidate.id === chunk.id ||
      (candidate.text === chunk.text && candidate.source === chunk.source),
    );

    if (!existing?.embedding) {
      return chunk;
    }

    return {
      ...chunk,
      embedding: existing.embedding,
      embeddingModel: existing.embeddingModel,
    };
  });
}

export async function saveSessionDocuments(sessionId, contexts) {
  const documents = contexts.map((context) => buildStoredDocument(sessionId, context));

  await withStore('readwrite', async (store) => {
    for (const documentRecord of documents) {
      const existing = await requestToPromise(store.get(documentRecord.id));
      if (existing?.chunks?.length) {
        documentRecord.chunks = mergeChunkEmbeddings(documentRecord.chunks, existing.chunks);
      }

      logDocStore('Saving document', {
        id: documentRecord.id,
        title: documentRecord.title,
        url: documentRecord.url,
        chunkCount: documentRecord.chunks.length,
        charCount: documentRecord.charCount,
        structuredContentLength: documentRecord.structuredContent.length,
        sampleChunk: documentRecord.chunks[0],
      });
      store.put(documentRecord);
    }
  });

  return documents;
}

export async function saveSessionDocumentRecords(documents) {
  await withStore('readwrite', async (store) => {
    for (const documentRecord of documents) {
      logDocStore('Persisting updated document record', {
        id: documentRecord.id,
        chunkCount: documentRecord.chunks.length,
      });
      store.put(documentRecord);
    }
  });

  return documents;
}

export async function loadSessionDocuments(sessionId) {
  return withStore('readonly', async (store) => {
    const index = store.index('sessionId');
    const request = index.getAll(sessionId);
    const result = await requestToPromise(request);
    logDocStore('Loaded session documents', {
      sessionId,
      count: result.length,
    });
    return result;
  });
}
