/**
 * Authentication Service
 * 
 * Handles Google OAuth authentication using chrome.identity API
 * and Firebase Authentication REST API.
 */

import { firebaseConfig, CHROME_CLIENT_ID, FIREBASE_AUTH_URL } from '../config/firebase-config.js';

// ============================================================================
// STATE
// ============================================================================

let currentUser = null;
let authStateListeners = [];
let idToken = null;
let idTokenExpiresAt = 0;
let refreshPromise = null;

const AUTH_STORAGE_KEYS = ['user', 'idToken', 'refreshToken', 'idTokenExpiresAt'];
const TOKEN_REFRESH_BUFFER_MS = 60 * 1000;

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Sign in with Google using chrome.identity API
 * @returns {Promise<Object>} User object
 */
export async function signInWithGoogle() {
  try {
    console.log('[Auth] Starting Google sign in...');
    
    // Get Google OAuth token using chrome.identity
    const token = await getGoogleAuthToken();
    console.log('[Auth] Got Google token');
    
    // Exchange Google token for Firebase ID token
    const firebaseAuth = await signInWithGoogleToken(token);
    console.log('[Auth] Firebase auth response:', { 
      hasIdToken: !!firebaseAuth.idToken, 
      hasRefreshToken: !!firebaseAuth.refreshToken,
      email: firebaseAuth.email 
    });
    
    applyFirebaseAuthState(firebaseAuth);

    const dataToSave = getPersistedAuthState(firebaseAuth.refreshToken);
    console.log('[Auth] Saving to storage:', { user: !!dataToSave.user, idToken: !!dataToSave.idToken, refreshToken: !!dataToSave.refreshToken });
    await chrome.storage.local.set(dataToSave);
    
    // Verify save
    const verify = await chrome.storage.local.get(AUTH_STORAGE_KEYS);
    console.log('[Auth] Verified storage:', { user: !!verify.user, idToken: !!verify.idToken, refreshToken: !!verify.refreshToken, idTokenExpiresAt: !!verify.idTokenExpiresAt });
    
    // Notify listeners
    notifyAuthStateChanged(currentUser);
    
    return currentUser;
  } catch (error) {
    console.error('[Auth] Sign in failed:', error);
    throw error;
  }
}

/**
 * Sign out the current user
 */
export async function signOut() {
  try {
    console.log('[Auth] Signing out...');
    
    try {
      await chrome.identity.clearAllCachedAuthTokens();
    } catch (e) {
      // Ignore errors - may not be available
      console.log('[Auth] clearAllCachedAuthTokens not available');
    }

    await clearLocalAuthState();
    
    console.log('[Auth] Signed out successfully');
  } catch (error) {
    console.error('[Auth] Sign out failed:', error);
    await clearLocalAuthState();
  }
}

/**
 * Get the current user
 * @returns {Object|null} Current user or null
 */
export function getCurrentUser() {
  return currentUser;
}

/**
 * Set current user from cached storage data.
 * Called early during popup init so that getCurrentUser() returns a value
 * before initAuth() completes its async token refresh.
 */
export function setCurrentUser(user) {
  if (!currentUser && user) {
    currentUser = user;
  }
}

/**
 * Get the current ID token (for API calls)
 * @returns {Promise<string|null>} ID token or null
 */
export async function getIdToken() {
  if (!idToken || isTokenExpiringSoon(idTokenExpiresAt)) {
    const stored = await chrome.storage.local.get(['idToken', 'refreshToken', 'idTokenExpiresAt']);
    if (!idToken && stored.idToken) {
      idToken = stored.idToken;
      idTokenExpiresAt = stored.idTokenExpiresAt || getTokenExpiryFromJwt(stored.idToken);
    }

    if (stored.refreshToken && (!idToken || isTokenExpiringSoon(idTokenExpiresAt))) {
      try {
        await refreshIdToken(stored.refreshToken);
      } catch (error) {
        if (isPermanentRefreshFailure(error)) {
          const restored = await trySilentReauth();
          if (!restored) {
            await clearLocalAuthState();
            return null;
          }
        } else {
          throw error;
        }
      }
    }
  }
  return isTokenExpiringSoon(idTokenExpiresAt) ? null : idToken;
}

/**
 * Register an auth state change listener
 * @param {Function} callback - Called with user object or null
 * @returns {Function} Unsubscribe function
 */
export function onAuthStateChanged(callback) {
  authStateListeners.push(callback);
  
  // Call immediately with current state
  callback(currentUser);
  
  // Return unsubscribe function
  return () => {
    authStateListeners = authStateListeners.filter(cb => cb !== callback);
  };
}

/**
 * Initialize auth state from storage
 */
export async function initAuth() {
  try {
    const stored = await chrome.storage.local.get(AUTH_STORAGE_KEYS);
    console.log('[Auth] Stored data:', { user: !!stored.user, idToken: !!stored.idToken, refreshToken: !!stored.refreshToken, idTokenExpiresAt: !!stored.idTokenExpiresAt });
    
    if (stored.user && stored.refreshToken) {
      currentUser = stored.user;
      idToken = stored.idToken || null;
      idTokenExpiresAt = stored.idTokenExpiresAt || getTokenExpiryFromJwt(stored.idToken);
      
      if (!idToken || isTokenExpiringSoon(idTokenExpiresAt)) {
        try {
          await refreshIdToken(stored.refreshToken);
          console.log('[Auth] Token refreshed successfully');
        } catch (error) {
          if (isPermanentRefreshFailure(error)) {
            console.warn('[Auth] Refresh token is no longer valid, attempting silent re-auth:', error);
            const restored = await trySilentReauth();
            if (!restored) {
              console.warn('[Auth] Silent re-auth failed, clearing local auth state');
              await clearLocalAuthState();
              return;
            }
          } else {
            console.warn('[Auth] Token refresh failed temporarily, keeping cached auth state:', error);
          }
        }
      }

      notifyAuthStateChanged(currentUser);
    } else if (stored.user && stored.idToken) {
      currentUser = stored.user;
      idToken = stored.idToken;
      idTokenExpiresAt = stored.idTokenExpiresAt || getTokenExpiryFromJwt(stored.idToken);

      if (!isTokenExpiringSoon(idTokenExpiresAt)) {
        console.log('[Auth] Using existing token without refresh');
        notifyAuthStateChanged(currentUser);
      } else {
        console.warn('[Auth] Stored token expired and no refresh token is available');
        await clearLocalAuthState();
      }
    }
  } catch (error) {
    console.error('[Auth] Failed to initialize auth:', error);
  }
}

// ============================================================================
// PRIVATE HELPERS
// ============================================================================

/**
 * Get Google OAuth token using chrome.identity.launchWebAuthFlow
 * This method is more reliable across different Chrome configurations
 */
async function getGoogleAuthToken(interactive = true) {
  const redirectUri = chrome.identity.getRedirectURL();
  const clientId = CHROME_CLIENT_ID;
  const scopes = ['openid', 'email', 'profile'].join(' ');
  
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'token');
  authUrl.searchParams.set('scope', scopes);
  if (!interactive) {
    authUrl.searchParams.set('prompt', 'none');
  }
  
  return new Promise((resolve, reject) => {
    chrome.identity.launchWebAuthFlow(
      {
        url: authUrl.toString(),
        interactive,
      },
      (responseUrl) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        
        if (!responseUrl) {
          reject(new Error('No response URL'));
          return;
        }
        
        // Extract access token from URL fragment
        const url = new URL(responseUrl);
        const params = new URLSearchParams(url.hash.substring(1));
        const accessToken = params.get('access_token');
        
        if (!accessToken) {
          reject(new Error('No access token in response'));
          return;
        }
        
        resolve(accessToken);
      }
    );
  });
}

/**
 * Exchange Google OAuth token for Firebase ID token
 */
async function signInWithGoogleToken(googleToken) {
  const redirectUri = chrome.identity.getRedirectURL();
  
  const response = await fetch(
    `${FIREBASE_AUTH_URL}/accounts:signInWithIdp?key=${firebaseConfig.apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        postBody: `access_token=${googleToken}&providerId=google.com`,
        requestUri: redirectUri,
        returnSecureToken: true,
        returnIdpCredential: true,
      }),
    }
  );
  
  if (!response.ok) {
    const error = await response.json();
    console.error('[Auth] Firebase signInWithIdp error:', error);
    throw new Error(error.error?.message || 'Firebase authentication failed');
  }
  
  return response.json();
}

/**
 * Refresh the Firebase ID token
 */
async function refreshIdToken(refreshToken) {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    let response;
    try {
      response = await fetch(
        `https://securetoken.googleapis.com/v1/token?key=${firebaseConfig.apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `grant_type=refresh_token&refresh_token=${refreshToken}`,
        }
      );
    } catch (error) {
      throw createRefreshError('NETWORK_ERROR', error.message || 'Network error during token refresh', true);
    }
    
    if (!response.ok) {
      const errorData = await safeReadJson(response);
      const message = errorData?.error?.message || `HTTP_${response.status}`;
      throw createRefreshError(message, 'Token refresh failed', isRetryableRefreshStatus(response.status));
    }
    
    const data = await response.json();
    idToken = data.id_token;
    idTokenExpiresAt = getTokenExpiryFromJwt(data.id_token, data.expires_in);
    
    await chrome.storage.local.set({ 
      idToken,
      refreshToken: data.refresh_token || refreshToken,
      idTokenExpiresAt,
    });
    
    return idToken;
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

/**
 * Notify all auth state listeners
 */
function notifyAuthStateChanged(user) {
  authStateListeners.forEach(callback => {
    try {
      callback(user);
    } catch (error) {
      console.error('Auth state listener error:', error);
    }
  });
}

async function clearLocalAuthState() {
  currentUser = null;
  idToken = null;
  idTokenExpiresAt = 0;
  await chrome.storage.local.remove(AUTH_STORAGE_KEYS);
  notifyAuthStateChanged(null);
}

function applyFirebaseAuthState(firebaseAuth) {
  idToken = firebaseAuth.idToken;
  idTokenExpiresAt = getTokenExpiryFromJwt(firebaseAuth.idToken, firebaseAuth.expiresIn);
  currentUser = {
    uid: firebaseAuth.localId,
    email: firebaseAuth.email,
    displayName: firebaseAuth.displayName || firebaseAuth.email.split('@')[0],
    photoURL: firebaseAuth.photoUrl,
  };
}

function getPersistedAuthState(refreshToken) {
  return {
    user: currentUser,
    idToken,
    refreshToken,
    idTokenExpiresAt,
  };
}

async function trySilentReauth() {
  if (!currentUser) {
    return false;
  }

  try {
    console.log('[Auth] Trying silent Google re-auth...');
    const token = await getGoogleAuthToken(false);
    const firebaseAuth = await signInWithGoogleToken(token);
    applyFirebaseAuthState(firebaseAuth);
    await chrome.storage.local.set(getPersistedAuthState(firebaseAuth.refreshToken));
    console.log('[Auth] Silent re-auth succeeded');
    return true;
  } catch (error) {
    console.warn('[Auth] Silent re-auth failed:', error);
    return false;
  }
}

function getTokenExpiryFromJwt(token, expiresInSeconds) {
  if (typeof expiresInSeconds !== 'undefined') {
    const parsed = Number(expiresInSeconds);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Date.now() + parsed * 1000;
    }
  }

  if (!token) {
    return 0;
  }

  try {
    const [, payload] = token.split('.');
    if (!payload) {
      return 0;
    }

    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(normalized.length + ((4 - normalized.length % 4) % 4), '=');
    const decoded = JSON.parse(atob(padded));
    return decoded.exp ? decoded.exp * 1000 : 0;
  } catch {
    return 0;
  }
}

function isTokenExpiringSoon(expiresAt) {
  if (!expiresAt) {
    return true;
  }
  return Date.now() >= expiresAt - TOKEN_REFRESH_BUFFER_MS;
}

function createRefreshError(code, message, retryable) {
  const error = new Error(message);
  error.code = code;
  error.retryable = retryable;
  return error;
}

function isRetryableRefreshStatus(status) {
  return status === 408 || status === 429 || status >= 500;
}

function isPermanentRefreshFailure(error) {
  return !!error && error.retryable === false;
}

async function safeReadJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}
