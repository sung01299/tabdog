/*
 * LEGACY NOTICE:
 * This extension-side embeddings service belongs to the legacy chat/RAG path.
 * Embedding generation and retrieval are expected to move to the backend service.
 */
const EMBEDDING_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const EMBEDDING_MODEL = 'gemini-embedding-001';
const EMBEDDING_DIMENSION = 768;
const EMBEDDING_BATCH_SIZE = 24;
const EMBEDDING_DEBUG_PREFIX = '[TabDog Chat][Embeddings]';

function logEmbeddings(label, payload) {
  if (payload === undefined) {
    console.log(`${EMBEDDING_DEBUG_PREFIX} ${label}`);
    return;
  }

  console.log(`${EMBEDDING_DEBUG_PREFIX} ${label}`, payload);
}

function chunkArray(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

async function parseErrorResponse(response) {
  try {
    const data = await response.json();
    return data?.error?.message || `Embedding request failed with status ${response.status}.`;
  } catch {
    return `Embedding request failed with status ${response.status}.`;
  }
}

function buildDocumentEmbeddingText(documentRecord, chunk) {
  const title = documentRecord.title || 'none';
  const sectionPath = Array.isArray(chunk.sectionPath) && chunk.sectionPath.length
    ? ` | section: ${chunk.sectionPath.join(' > ')}`
    : '';
  return `title: ${title} | text: ${chunk.text}${sectionPath}`;
}

function buildQueryEmbeddingText(question) {
  return question.trim();
}

async function embedBatch({ apiKey, texts, taskType, signal }) {
  const endpoint = `${EMBEDDING_API_BASE}/models/${EMBEDDING_MODEL}:embedContent`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey.trim(),
    },
    signal,
    body: JSON.stringify({
      model: `models/${EMBEDDING_MODEL}`,
      taskType,
      outputDimensionality: EMBEDDING_DIMENSION,
      content: {
        parts: texts.map((text) => ({ text })),
      },
    }),
  });

  logEmbeddings('Embedding batch response status', {
    endpoint,
    taskType,
    count: texts.length,
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
  });

  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }

  const payload = await response.json();
  const embeddings = (payload.embeddings || []).map((embedding) => embedding.values || []);
  logEmbeddings('Embedding batch payload summary', {
    taskType,
    count: embeddings.length,
    firstVectorLength: embeddings[0]?.length || 0,
  });
  return embeddings;
}

export async function embedDocumentsIfNeeded({ apiKey, documents, signal }) {
  const missing = [];

  for (const documentRecord of documents) {
    for (const chunk of documentRecord.chunks || []) {
      if (!Array.isArray(chunk.embedding) || chunk.embedding.length !== EMBEDDING_DIMENSION) {
        missing.push({
          documentId: documentRecord.id,
          chunkId: chunk.id,
          text: buildDocumentEmbeddingText(documentRecord, chunk),
        });
      }
    }
  }

  if (!missing.length) {
    logEmbeddings('All document chunk embeddings already present', {
      documentCount: documents.length,
    });
    return documents;
  }

  logEmbeddings('Embedding missing document chunks', {
    missingCount: missing.length,
    documentCount: documents.length,
  });

  const batches = chunkArray(missing, EMBEDDING_BATCH_SIZE);
  let offset = 0;

  for (const batch of batches) {
    const vectors = await embedBatch({
      apiKey,
      texts: batch.map((item) => item.text),
      taskType: 'RETRIEVAL_DOCUMENT',
      signal,
    });

    batch.forEach((item, index) => {
      const vector = vectors[index] || [];
      const documentRecord = documents.find((doc) => doc.id === item.documentId);
      const chunk = documentRecord?.chunks?.find((entry) => entry.id === item.chunkId);

      if (chunk) {
        chunk.embedding = vector;
        chunk.embeddingModel = EMBEDDING_MODEL;
      }
    });

    offset += batch.length;
    logEmbeddings('Embedded document chunk batch', {
      completed: offset,
      total: missing.length,
    });
  }

  return documents;
}

export async function embedQuestion({ apiKey, question, signal }) {
  logEmbeddings('Embedding question', {
    question,
  });

  const [vector] = await embedBatch({
    apiKey,
    texts: [buildQueryEmbeddingText(question)],
    taskType: 'QUESTION_ANSWERING',
    signal,
  });

  return vector || [];
}

export function cosineSimilarity(a = [], b = []) {
  if (!a.length || !b.length || a.length !== b.length) {
    return 0;
  }

  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (let index = 0; index < a.length; index += 1) {
    const av = a[index];
    const bv = b[index];
    dot += av * bv;
    magA += av * av;
    magB += bv * bv;
  }

  if (!magA || !magB) {
    return 0;
  }

  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}
