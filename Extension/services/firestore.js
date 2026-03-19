/**
 * Firestore REST API Service
 * 
 * Provides a simple interface to Firestore using REST API.
 * This is needed because Firebase SDK doesn't work well in Manifest V3 service workers.
 */

import { FIRESTORE_URL } from '../config/firebase-config.js';
import { getIdToken } from './auth.js';

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Set a document in Firestore
 * @param {string} path - Document path (e.g., "users/uid123/devices/device1")
 * @param {Object} data - Document data
 * @param {boolean} merge - If true, merge with existing document
 */
export async function firestoreSet(path, data, merge = false) {
  const idToken = await getIdToken();
  if (!idToken) throw new Error('Not authenticated');
  
  const url = `${FIRESTORE_URL}/${path}`;
  const method = merge ? 'PATCH' : 'PATCH';
  
  const response = await fetch(`${url}?${merge ? 'updateMask.fieldPaths=' + Object.keys(data).join('&updateMask.fieldPaths=') : ''}`, {
    method,
    headers: {
      'Authorization': `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fields: objectToFirestore(data),
    }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Firestore set failed');
  }
  
  return firestoreToObject(await response.json());
}

/**
 * Get a document from Firestore
 * @param {string} path - Document path
 * @returns {Promise<Object|null>} Document data or null if not found
 */
export async function firestoreGet(path) {
  const idToken = await getIdToken();
  if (!idToken) throw new Error('Not authenticated');
  
  const response = await fetch(`${FIRESTORE_URL}/${path}`, {
    headers: {
      'Authorization': `Bearer ${idToken}`,
    },
  });
  
  if (response.status === 404) {
    return null;
  }
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Firestore get failed');
  }
  
  return firestoreToObject(await response.json());
}

/**
 * Delete a document from Firestore
 * @param {string} path - Document path
 */
export async function firestoreDelete(path) {
  const idToken = await getIdToken();
  if (!idToken) throw new Error('Not authenticated');
  
  const response = await fetch(`${FIRESTORE_URL}/${path}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${idToken}`,
    },
  });
  
  if (!response.ok && response.status !== 404) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Firestore delete failed');
  }
}

/**
 * List documents in a collection
 * @param {string} collectionPath - Collection path
 * @returns {Promise<Array>} List of documents
 */
export async function firestoreList(collectionPath) {
  const idToken = await getIdToken();
  if (!idToken) throw new Error('Not authenticated');
  
  const response = await fetch(`${FIRESTORE_URL}/${collectionPath}`, {
    headers: {
      'Authorization': `Bearer ${idToken}`,
    },
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Firestore list failed');
  }
  
  const result = await response.json();
  
  if (!result.documents) {
    return [];
  }
  
  return result.documents.map(doc => {
    const pathParts = doc.name.split('/');
    const id = pathParts[pathParts.length - 1];
    return {
      id,
      ...firestoreToObject(doc),
    };
  });
}

// ============================================================================
// DATA CONVERSION HELPERS
// ============================================================================

/**
 * Convert JavaScript object to Firestore format
 */
function objectToFirestore(obj) {
  const fields = {};
  
  for (const [key, value] of Object.entries(obj)) {
    fields[key] = valueToFirestore(value);
  }
  
  return fields;
}

/**
 * Convert a JavaScript value to Firestore format
 */
function valueToFirestore(value) {
  if (value === null || value === undefined) {
    return { nullValue: null };
  }
  
  if (typeof value === 'boolean') {
    return { booleanValue: value };
  }
  
  if (typeof value === 'number') {
    if (Number.isInteger(value)) {
      return { integerValue: value.toString() };
    }
    return { doubleValue: value };
  }
  
  if (typeof value === 'string') {
    // Check if it's an ISO date string
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
      return { timestampValue: value };
    }
    return { stringValue: value };
  }
  
  if (Array.isArray(value)) {
    return {
      arrayValue: {
        values: value.map(valueToFirestore),
      },
    };
  }
  
  if (typeof value === 'object') {
    return {
      mapValue: {
        fields: objectToFirestore(value),
      },
    };
  }
  
  return { stringValue: String(value) };
}

/**
 * Convert Firestore document to JavaScript object
 */
function firestoreToObject(doc) {
  if (!doc.fields) {
    return {};
  }
  
  const obj = {};
  
  for (const [key, value] of Object.entries(doc.fields)) {
    obj[key] = firestoreToValue(value);
  }
  
  return obj;
}

/**
 * Convert Firestore value to JavaScript value
 */
function firestoreToValue(value) {
  if ('nullValue' in value) return null;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) return parseInt(value.integerValue, 10);
  if ('doubleValue' in value) return value.doubleValue;
  if ('stringValue' in value) return value.stringValue;
  if ('timestampValue' in value) return value.timestampValue;
  if ('arrayValue' in value) {
    return (value.arrayValue.values || []).map(firestoreToValue);
  }
  if ('mapValue' in value) {
    return firestoreToObject({ fields: value.mapValue.fields });
  }
  return null;
}
