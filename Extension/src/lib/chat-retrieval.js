import { cosineSimilarity } from '../../services/gemini-embeddings.js';

const RETRIEVAL_DEBUG_PREFIX = '[TabDog Chat][Retrieval]';
const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
  'how', 'i', 'in', 'is', 'it', 'of', 'on', 'or', 'that', 'the',
  'this', 'to', 'was', 'what', 'when', 'where', 'which', 'who', 'why',
  'with', 'you', 'your',
]);
const TABLE_HINTS = ['table', 'row', 'column', 'spreadsheet', 'matrix', 'price', 'pricing'];
const CODE_HINTS = ['code', 'function', 'class', 'method', 'variable', 'error', 'stack', 'syntax'];
const LIST_HINTS = ['list', 'steps', 'bullet', 'items', 'options', 'checklist'];

function logRetrieval(label, payload) {
  if (payload === undefined) {
    console.log(`${RETRIEVAL_DEBUG_PREFIX} ${label}`);
    return;
  }

  console.log(`${RETRIEVAL_DEBUG_PREFIX} ${label}`, payload);
}

function tokenize(text) {
  return (text || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && !STOP_WORDS.has(token));
}

function countTokenOccurrences(tokens) {
  const counts = new Map();
  for (const token of tokens) {
    counts.set(token, (counts.get(token) || 0) + 1);
  }
  return counts;
}

function normalizeEmbeddingScore(score) {
  if (!Number.isFinite(score)) {
    return 0;
  }

  return Math.max(0, (score + 1) / 2);
}

function buildPhraseSet(tokens, size = 2) {
  const phrases = [];
  for (let index = 0; index <= tokens.length - size; index += 1) {
    phrases.push(tokens.slice(index, index + size).join(' '));
  }
  return phrases;
}

function getQuestionNumbers(question) {
  return (question.match(/\d+(?:\.\d+)?/g) || []).map((value) => value.trim());
}

function scoreChunk(questionTokens, chunk, title, url) {
  const chunkText = chunk.text || '';
  const chunkTokens = tokenize(chunkText);
  if (!chunkTokens.length) {
    return 0;
  }

  const chunkCounts = countTokenOccurrences(chunkTokens);
  let score = 0;

  for (const token of questionTokens) {
    const occurrences = chunkCounts.get(token) || 0;
    if (!occurrences) continue;
    score += 4 + Math.min(occurrences, 6);
  }

  const lowerChunk = chunkText.toLowerCase();
  const lowerTitle = (title || '').toLowerCase();
  const lowerUrl = (url || '').toLowerCase();

  for (const token of questionTokens) {
    if (lowerTitle.includes(token)) {
      score += 3;
    }

    if (lowerUrl.includes(token)) {
      score += 2;
    }

    if (/\d/.test(token) && lowerChunk.includes(token)) {
      score += 5;
    }
  }

  return score;
}

function scoreChunkWithRerank(question, questionTokens, chunk, title, url) {
  const baseScore = scoreChunk(questionTokens, chunk, title, url);
  const lowerQuestion = question.toLowerCase();
  const lowerChunk = (chunk.text || '').toLowerCase();
  const lowerSectionPath = (chunk.sectionPath || []).join(' ').toLowerCase();
  const phrases = buildPhraseSet(questionTokens, 2);
  const questionNumbers = getQuestionNumbers(question);

  let rerank = baseScore;
  let coverageCount = 0;

  for (const token of questionTokens) {
    if (lowerChunk.includes(token) || lowerSectionPath.includes(token)) {
      coverageCount += 1;
    }
  }

  if (questionTokens.length > 0) {
    rerank += (coverageCount / questionTokens.length) * 12;
  }

  for (const phrase of phrases) {
    if (phrase.length > 4 && lowerChunk.includes(phrase)) {
      rerank += 8;
    }
    if (phrase.length > 4 && lowerSectionPath.includes(phrase)) {
      rerank += 6;
    }
  }

  for (const number of questionNumbers) {
    if (lowerChunk.includes(number)) {
      rerank += 10;
    }
  }

  const blockKinds = chunk.blockKinds || [];
  if (TABLE_HINTS.some((hint) => lowerQuestion.includes(hint)) && blockKinds.includes('table')) {
    rerank += 10;
  }
  if (CODE_HINTS.some((hint) => lowerQuestion.includes(hint)) && blockKinds.includes('code')) {
    rerank += 10;
  }
  if (LIST_HINTS.some((hint) => lowerQuestion.includes(hint)) && blockKinds.includes('list')) {
    rerank += 7;
  }
  if (blockKinds.includes('heading')) {
    rerank += 2;
  }

  if (chunk.source === 'raw') {
    rerank -= 2;
  }

  if (chunk.charCount && chunk.charCount < 120) {
    rerank -= 2;
  }

  return rerank;
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

function getHybridScore(entry) {
  return entry.rerankScore + (entry.embeddingScore * 28);
}

function pickCoverageChunks(documentRecord, count) {
  const chunks = documentRecord.chunks || [];
  if (!chunks.length || count <= 0) {
    return [];
  }

  if (chunks.length <= count) {
    return chunks;
  }

  const indexes = new Set([0, chunks.length - 1]);
  while (indexes.size < count) {
    const ratio = indexes.size / Math.max(1, count - 1);
    const index = Math.min(
      chunks.length - 1,
      Math.max(0, Math.round(ratio * (chunks.length - 1))),
    );
    indexes.add(index);
  }

  return [...indexes]
    .sort((a, b) => a - b)
    .map((index) => chunks[index]);
}

export function retrieveRelevantChunks({
  documents,
  question,
  selectedTabIds = [],
  queryEmbedding = null,
  maxChunks = 10,
  minChunksPerDocument = 2,
}) {
  const questionTokens = tokenize(question);
  const prioritizedDocuments = [...documents].sort((a, b) => {
    const aSelected = selectedTabIds.includes(a.tabId) ? 1 : 0;
    const bSelected = selectedTabIds.includes(b.tabId) ? 1 : 0;
    return bSelected - aSelected;
  });

  const scoredEntries = prioritizedDocuments.flatMap((documentRecord, docIndex) =>
    (documentRecord.chunks || []).map((chunk) => ({
      documentRecord,
      docIndex,
      chunk,
      baseScore: scoreChunk(questionTokens, chunk, documentRecord.title, documentRecord.url),
      rerankScore: scoreChunkWithRerank(question, questionTokens, chunk, documentRecord.title, documentRecord.url),
      embeddingScore: normalizeEmbeddingScore(queryEmbedding
        ? cosineSimilarity(queryEmbedding, chunk.embedding || [])
        : 0),
    })),
  );

  scoredEntries.sort((a, b) => {
    const hybridA = getHybridScore(a);
    const hybridB = getHybridScore(b);

    if (hybridB !== hybridA) {
      return hybridB - hybridA;
    }

    if (b.rerankScore !== a.rerankScore) {
      return b.rerankScore - a.rerankScore;
    }

    if (b.baseScore !== a.baseScore) {
      return b.baseScore - a.baseScore;
    }

    return (a.chunk.charCount || 0) - (b.chunk.charCount || 0);
  });

  const selected = [];
  const seenChunkIds = new Set();
  const perDocumentCount = new Map();
  const activeDocuments = prioritizedDocuments.filter((documentRecord) =>
    !selectedTabIds.length || selectedTabIds.includes(documentRecord.tabId),
  );
  const perDocumentQuota = Math.max(
    minChunksPerDocument,
    Math.min(4, Math.floor(maxChunks / Math.max(1, activeDocuments.length))),
  );

  function addEntry(entry) {
    const docKey = entry.documentRecord.id;
    const globalChunkKey = `${docKey}:${entry.chunk.id}`;
    if (seenChunkIds.has(globalChunkKey) || selected.length >= maxChunks) {
      return false;
    }

    selected.push(entry);
    seenChunkIds.add(globalChunkKey);
    perDocumentCount.set(docKey, (perDocumentCount.get(docKey) || 0) + 1);
    return true;
  }

  for (const [docIndex, documentRecord] of activeDocuments.entries()) {
    if (selected.length >= maxChunks) break;

    const docEntries = scoredEntries
      .filter((entry) => entry.documentRecord.id === documentRecord.id)
      .sort((a, b) => getHybridScore(b) - getHybridScore(a));

    const strongEntries = docEntries.filter((entry) => getHybridScore(entry) > 0);
    const chosenEntries = strongEntries.slice(0, perDocumentQuota);

    if (chosenEntries.length) {
      for (const entry of chosenEntries) {
        addEntry(entry);
        if (selected.length >= maxChunks) break;
      }
      continue;
    }

    const coverageChunks = pickCoverageChunks(documentRecord, perDocumentQuota);
    for (const chunk of coverageChunks) {
      addEntry({
        documentRecord,
        docIndex,
        chunk,
        baseScore: 0,
        rerankScore: 0,
        embeddingScore: 0,
      });
      if (selected.length >= maxChunks) break;
    }
  }

  for (const entry of scoredEntries) {
    if (selected.length >= maxChunks) break;
    const docKey = entry.documentRecord.id;
    const alreadyPicked = perDocumentCount.get(docKey) || 0;
    const hybridScore = getHybridScore(entry);

    if (hybridScore <= 0 && alreadyPicked >= perDocumentQuota) {
      continue;
    }
    if (!addEntry(entry)) {
      continue;
    }

    const neighborIndexes = [
      entry.chunk.index - 1,
      entry.chunk.index + 1,
    ];

    for (const neighborIndex of neighborIndexes) {
      if (selected.length >= maxChunks) break;
      if (neighborIndex < 0) continue;

      const neighborChunk = entry.documentRecord.chunks?.find((chunk) => chunk.index === neighborIndex);
      if (!neighborChunk) continue;

      addEntry({
        documentRecord: entry.documentRecord,
        docIndex: entry.docIndex,
        chunk: neighborChunk,
        baseScore: entry.baseScore - 1,
        rerankScore: entry.rerankScore - 1,
        embeddingScore: entry.embeddingScore,
      });
    }
  }

  for (const [docIndex, documentRecord] of activeDocuments.entries()) {
    if (selected.length >= maxChunks) break;
    const docKey = documentRecord.id;
    const alreadyPicked = perDocumentCount.get(docKey) || 0;
    if (alreadyPicked >= minChunksPerDocument) continue;

    const coverageChunks = pickCoverageChunks(documentRecord, minChunksPerDocument - alreadyPicked);
    for (const chunk of coverageChunks) {
      addEntry({
        documentRecord,
        docIndex,
        chunk,
        baseScore: 0,
        rerankScore: 0,
        embeddingScore: 0,
      });
      if (selected.length >= maxChunks) break;
    }
  }

  const evidenceChunks = selected.map((entry) =>
    buildEvidenceChunk(entry.documentRecord, entry.chunk, entry.docIndex),
  );

  logRetrieval('Retrieved chunks', {
    question,
    questionTokens,
    selectedTabIds,
    selectedCount: evidenceChunks.length,
    chunks: evidenceChunks.map((chunk) => ({
      chunkId: chunk.chunkId,
      title: chunk.title,
      url: chunk.url,
      charCount: chunk.charCount,
      sectionPath: chunk.sectionPath,
      blockKinds: chunk.blockKinds,
      preview: chunk.text.slice(0, 220),
      source: chunk.source,
    })),
  });

  return evidenceChunks;
}
