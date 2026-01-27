/**
 * Tab Share Service
 * 
 * Manages shared tab links stored in Firestore.
 * Shares are stored in a top-level collection for public access.
 */

import { getCurrentUser, getIdToken } from './auth.js';
import { firebaseConfig, FIRESTORE_URL } from '../config/firebase-config.js';

// ============================================================================
// CONSTANTS
// ============================================================================

const SHARE_BASE_URL = 'https://tabdog.app/s/'; // Will redirect to GitHub Pages
const SHARES_COLLECTION = 'shares';

// Expiration options in days
export const EXPIRATION_OPTIONS = {
  '1_day': 1,
  '7_days': 7,
  '30_days': 30,
  'never': null,
};

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Create a share link for selected tabs
 * @param {Array} tabs - Array of tab objects to share
 * @param {Object} options - Share options
 * @param {string} options.expiration - Expiration option key
 * @param {string} options.title - Optional title for the share
 * @returns {Promise<Object>} Share data with URL
 */
export async function createShareLink(tabs, options = {}) {
  const user = getCurrentUser();
  if (!user) {
    throw new Error('Must be logged in to create share links');
  }
  
  const idToken = await getIdToken();
  if (!idToken) {
    throw new Error('Not authenticated');
  }
  
  const shareId = generateShareId();
  const now = new Date();
  
  // Calculate expiration date
  let expiresAt = null;
  if (options.expiration && EXPIRATION_OPTIONS[options.expiration]) {
    const days = EXPIRATION_OPTIONS[options.expiration];
    expiresAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
  }
  
  const shareData = {
    id: shareId,
    creatorId: user.uid,
    creatorName: user.displayName || 'Anonymous',
    title: options.title || `${tabs.length} tabs`,
    tabs: tabs.map(tab => ({
      url: tab.url,
      title: tab.title,
      favIconUrl: tab.favIconUrl,
    })),
    tabCount: tabs.length,
    createdAt: now.toISOString(),
    expiresAt,
    viewCount: 0,
  };
  
  // Save to Firestore
  const url = `${FIRESTORE_URL.replace('/users/' + user.uid, '')}/${SHARES_COLLECTION}/${shareId}`;
  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fields: objectToFirestore(shareData),
    }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to create share link');
  }
  
  return {
    ...shareData,
    url: SHARE_BASE_URL + shareId,
  };
}

/**
 * Get share data by ID (for viewing shared tabs)
 * @param {string} shareId - Share ID
 * @returns {Promise<Object|null>} Share data or null if not found/expired
 */
export async function getShareData(shareId) {
  try {
    const url = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/${SHARES_COLLECTION}/${shareId}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error('Failed to fetch share data');
    }
    
    const doc = await response.json();
    const data = firestoreToObject(doc);
    
    // Check if expired
    if (data.expiresAt && new Date(data.expiresAt) < new Date()) {
      return null; // Expired
    }
    
    return data;
  } catch (error) {
    console.error('Failed to get share data:', error);
    return null;
  }
}

/**
 * Increment view count for a share
 * @param {string} shareId - Share ID
 */
export async function incrementViewCount(shareId) {
  try {
    // Get current data
    const shareData = await getShareData(shareId);
    if (!shareData) return;
    
    // Update view count (unauthenticated update not allowed, skip for now)
    // This would require a Cloud Function or relaxed security rules
    console.log('View count increment skipped (requires Cloud Function)');
  } catch (error) {
    console.error('Failed to increment view count:', error);
  }
}

/**
 * Delete a share (only creator can delete)
 * @param {string} shareId - Share ID
 */
export async function deleteShare(shareId) {
  const user = getCurrentUser();
  if (!user) {
    throw new Error('Must be logged in to delete shares');
  }
  
  const idToken = await getIdToken();
  if (!idToken) {
    throw new Error('Not authenticated');
  }
  
  const url = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/${SHARES_COLLECTION}/${shareId}`;
  
  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${idToken}`,
    },
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to delete share');
  }
}

/**
 * Get user's created shares
 * @returns {Promise<Array>} List of shares created by current user
 */
export async function getMyShares() {
  const user = getCurrentUser();
  if (!user) return [];
  
  const idToken = await getIdToken();
  if (!idToken) return [];
  
  try {
    // Query shares by creatorId
    const url = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents:runQuery`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: SHARES_COLLECTION }],
          where: {
            fieldFilter: {
              field: { fieldPath: 'creatorId' },
              op: 'EQUAL',
              value: { stringValue: user.uid },
            },
          },
          orderBy: [{ field: { fieldPath: 'createdAt' }, direction: 'DESCENDING' }],
        },
      }),
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch shares');
    }
    
    const results = await response.json();
    
    return results
      .filter(r => r.document)
      .map(r => ({
        ...firestoreToObject(r.document),
        url: SHARE_BASE_URL + firestoreToObject(r.document).id,
      }));
  } catch (error) {
    console.error('Failed to get my shares:', error);
    return [];
  }
}

// ============================================================================
// PRIVATE HELPERS
// ============================================================================

/**
 * Generate a short unique share ID
 * @returns {string} Share ID (8 characters)
 */
function generateShareId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let id = '';
  for (let i = 0; i < 8; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

/**
 * Convert JavaScript object to Firestore format
 * @param {Object} obj - JavaScript object
 * @returns {Object} Firestore fields
 */
function objectToFirestore(obj) {
  const fields = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) {
      fields[key] = { nullValue: null };
    } else if (typeof value === 'string') {
      fields[key] = { stringValue: value };
    } else if (typeof value === 'number') {
      if (Number.isInteger(value)) {
        fields[key] = { integerValue: value.toString() };
      } else {
        fields[key] = { doubleValue: value };
      }
    } else if (typeof value === 'boolean') {
      fields[key] = { booleanValue: value };
    } else if (Array.isArray(value)) {
      fields[key] = {
        arrayValue: {
          values: value.map(item => {
            if (typeof item === 'object' && item !== null) {
              return { mapValue: { fields: objectToFirestore(item) } };
            } else if (typeof item === 'string') {
              return { stringValue: item };
            } else if (typeof item === 'number') {
              return Number.isInteger(item) 
                ? { integerValue: item.toString() }
                : { doubleValue: item };
            } else if (typeof item === 'boolean') {
              return { booleanValue: item };
            }
            return { nullValue: null };
          }),
        },
      };
    } else if (typeof value === 'object') {
      fields[key] = { mapValue: { fields: objectToFirestore(value) } };
    }
  }
  
  return fields;
}

/**
 * Convert Firestore document to JavaScript object
 * @param {Object} doc - Firestore document
 * @returns {Object} JavaScript object
 */
function firestoreToObject(doc) {
  if (!doc || !doc.fields) return null;
  
  const obj = {};
  
  // Extract document ID from name
  if (doc.name) {
    const parts = doc.name.split('/');
    obj.id = parts[parts.length - 1];
  }
  
  for (const [key, value] of Object.entries(doc.fields)) {
    obj[key] = parseFirestoreValue(value);
  }
  
  return obj;
}

/**
 * Parse a Firestore value
 * @param {Object} value - Firestore value
 * @returns {*} JavaScript value
 */
function parseFirestoreValue(value) {
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return parseInt(value.integerValue, 10);
  if ('doubleValue' in value) return value.doubleValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('nullValue' in value) return null;
  if ('arrayValue' in value) {
    return (value.arrayValue.values || []).map(parseFirestoreValue);
  }
  if ('mapValue' in value) {
    const obj = {};
    for (const [k, v] of Object.entries(value.mapValue.fields || {})) {
      obj[k] = parseFirestoreValue(v);
    }
    return obj;
  }
  return null;
}
