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
    
    // Store tokens
    idToken = firebaseAuth.idToken;
    
    // Create user object
    currentUser = {
      uid: firebaseAuth.localId,
      email: firebaseAuth.email,
      displayName: firebaseAuth.displayName || firebaseAuth.email.split('@')[0],
      photoURL: firebaseAuth.photoUrl,
    };
    
    // Save to storage
    const dataToSave = { 
      user: currentUser,
      idToken: idToken,
      refreshToken: firebaseAuth.refreshToken,
    };
    console.log('[Auth] Saving to storage:', { user: !!dataToSave.user, idToken: !!dataToSave.idToken, refreshToken: !!dataToSave.refreshToken });
    await chrome.storage.local.set(dataToSave);
    
    // Verify save
    const verify = await chrome.storage.local.get(['user', 'idToken', 'refreshToken']);
    console.log('[Auth] Verified storage:', { user: !!verify.user, idToken: !!verify.idToken, refreshToken: !!verify.refreshToken });
    
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
    
    // Clear cached auth (for launchWebAuthFlow)
    const redirectUri = chrome.identity.getRedirectURL();
    try {
      await chrome.identity.clearAllCachedAuthTokens();
    } catch (e) {
      // Ignore errors - may not be available
      console.log('[Auth] clearAllCachedAuthTokens not available');
    }
    
    // Revoke access by launching auth flow with prompt
    // This clears the browser's OAuth session
    try {
      await chrome.identity.launchWebAuthFlow({
        url: `https://accounts.google.com/logout`,
        interactive: false
      });
    } catch (e) {
      // Expected to fail, just clearing session
    }
    
    // Clear stored data
    currentUser = null;
    idToken = null;
    await chrome.storage.local.remove(['user', 'idToken', 'refreshToken']);
    
    console.log('[Auth] Signed out successfully');
    
    // Notify listeners
    notifyAuthStateChanged(null);
  } catch (error) {
    console.error('[Auth] Sign out failed:', error);
    // Still clear local state even if revoke fails
    currentUser = null;
    idToken = null;
    await chrome.storage.local.remove(['user', 'idToken', 'refreshToken']);
    notifyAuthStateChanged(null);
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
  if (!idToken) {
    // Try to restore from storage
    const stored = await chrome.storage.local.get(['idToken', 'refreshToken']);
    if (stored.refreshToken) {
      await refreshIdToken(stored.refreshToken);
    }
  }
  return idToken;
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
    const stored = await chrome.storage.local.get(['user', 'idToken', 'refreshToken']);
    console.log('[Auth] Stored data:', { user: !!stored.user, idToken: !!stored.idToken, refreshToken: !!stored.refreshToken });
    
    if (stored.user && stored.refreshToken) {
      currentUser = stored.user;
      idToken = stored.idToken;
      
      // Try to refresh the token
      try {
        await refreshIdToken(stored.refreshToken);
        console.log('[Auth] Token refreshed successfully');
        notifyAuthStateChanged(currentUser);
      } catch (error) {
        // Token refresh failed, user needs to sign in again
        console.warn('[Auth] Token refresh failed, clearing auth state:', error);
        await signOut();
      }
    } else if (stored.user && stored.idToken) {
      // Has user and token but no refresh token - try to use existing token
      currentUser = stored.user;
      idToken = stored.idToken;
      console.log('[Auth] Using existing token without refresh');
      notifyAuthStateChanged(currentUser);
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
  const response = await fetch(
    `https://securetoken.googleapis.com/v1/token?key=${firebaseConfig.apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=refresh_token&refresh_token=${refreshToken}`,
    }
  );
  
  if (!response.ok) {
    throw new Error('Token refresh failed');
  }
  
  const data = await response.json();
  idToken = data.id_token;
  
  // Update stored token
  await chrome.storage.local.set({ 
    idToken: idToken,
    refreshToken: data.refresh_token,
  });
  
  return idToken;
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
