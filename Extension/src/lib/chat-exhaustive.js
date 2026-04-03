/*
 * LEGACY NOTICE:
 * This exhaustive sweep helper is part of the legacy extension-side chat/RAG stack.
 * The backend/FastAPI implementation should become the primary home for this logic.
 */
const EXHAUSTIVE_DEBUG_PREFIX = '[TabDog Chat][Exhaustive]';
const EXHAUSTIVE_KEYWORDS = [
  'all', 'every', 'complete', 'entire', 'full', 'overall', 'summarize', 'summary',
  'list all', 'everything', 'compare', 'comparison', 'difference', 'differences',
  '전체', '전부', '모두', '전체적으로', '요약', '전반', '비교', '차이', '모든',
];

function logExhaustive(label, payload) {
  if (payload === undefined) {
    console.log(`${EXHAUSTIVE_DEBUG_PREFIX} ${label}`);
    return;
  }

  console.log(`${EXHAUSTIVE_DEBUG_PREFIX} ${label}`, payload);
}

function normalizeQuestion(question) {
  return (question || '').trim().toLowerCase();
}

function prioritizeDocuments(documents, selectedTabIds = []) {
  const selectedOrder = new Map(selectedTabIds.map((tabId, index) => [tabId, index]));

  return [...documents].sort((a, b) => {
    const aOrder = selectedOrder.has(a.tabId) ? selectedOrder.get(a.tabId) : Number.MAX_SAFE_INTEGER;
    const bOrder = selectedOrder.has(b.tabId) ? selectedOrder.get(b.tabId) : Number.MAX_SAFE_INTEGER;

    if (aOrder !== bOrder) {
      return aOrder - bOrder;
    }

    return (a.title || '').localeCompare(b.title || '');
  });
}

function buildEvidenceChunk(documentRecord, chunk, tabIndex) {
  return {
    tabId: documentRecord.tabId,
    tabLabel: `T${tabIndex + 1}`,
    chunkId: `${`T${tabIndex + 1}`}-${chunk.id.toUpperCase()}`,
    title: documentRecord.title,
    url: documentRecord.url,
    strategy: documentRecord.strategy,
    sectionPath: chunk.sectionPath || [],
    blockKinds: chunk.blockKinds || [],
    source: chunk.source || 'unknown',
    text: chunk.text,
    charCount: chunk.charCount,
  };
}

export function planQuestionMode({ question, documents, selectedTabIds = [] }) {
  const normalizedQuestion = normalizeQuestion(question);
  const totalChunks = documents.reduce((sum, documentRecord) => sum + (documentRecord.chunks?.length || 0), 0);
  const documentCount = documents.length;
  const selectedCount = selectedTabIds.length;
  const hasKeywordTrigger = EXHAUSTIVE_KEYWORDS.some((keyword) => normalizedQuestion.includes(keyword));

  let mode = 'retrieval';
  let reason = 'default-retrieval';

  if (hasKeywordTrigger) {
    mode = 'exhaustive';
    reason = 'question-keyword-trigger';
  } else if (selectedCount > 1) {
    mode = 'exhaustive';
    reason = 'multi-tab-question';
  } else if (totalChunks > 14) {
    mode = 'exhaustive';
    reason = 'large-document-sweep';
  }

  const decision = {
    mode,
    reason,
    totalChunks,
    documentCount,
    selectedCount,
  };

  logExhaustive('Question mode decision', {
    question,
    ...decision,
  });

  return decision;
}

export function createExhaustiveBatches(documents, selectedTabIds = [], { chunksPerBatch = 4 } = {}) {
  const orderedDocuments = prioritizeDocuments(documents, selectedTabIds);
  const batches = [];

  orderedDocuments.forEach((documentRecord, docIndex) => {
    const chunks = documentRecord.chunks || [];
    for (let start = 0; start < chunks.length; start += chunksPerBatch) {
      const batchChunks = chunks.slice(start, start + chunksPerBatch);
      if (!batchChunks.length) continue;

      const evidenceChunks = batchChunks.map((chunk) =>
        buildEvidenceChunk(documentRecord, chunk, docIndex),
      );

      batches.push({
        batchId: `${documentRecord.id}:batch-${Math.floor(start / chunksPerBatch) + 1}`,
        documentId: documentRecord.id,
        tabId: documentRecord.tabId,
        tabLabel: `T${docIndex + 1}`,
        title: documentRecord.title,
        url: documentRecord.url,
        evidenceChunks,
      });
    }
  });

  logExhaustive('Created exhaustive batches', {
    documentCount: orderedDocuments.length,
    batchCount: batches.length,
    chunksPerBatch,
  });

  return batches;
}

export function collectEvidenceChunksByIds(documents, selectedTabIds, chunkIds) {
  const orderedDocuments = prioritizeDocuments(documents, selectedTabIds);
  const chunkIdSet = new Set(chunkIds || []);
  const evidence = [];

  orderedDocuments.forEach((documentRecord, docIndex) => {
    for (const chunk of documentRecord.chunks || []) {
      const evidenceChunk = buildEvidenceChunk(documentRecord, chunk, docIndex);
      if (chunkIdSet.has(evidenceChunk.chunkId)) {
        evidence.push(evidenceChunk);
      }
    }
  });

  logExhaustive('Collected evidence chunks by ids', {
    requestedCount: chunkIdSet.size,
    foundCount: evidence.length,
  });

  return evidence;
}
