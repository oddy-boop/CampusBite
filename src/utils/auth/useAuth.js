import { router } from 'expo-router';
import { useCallback, useEffect } from 'react';
import { useAuthModal, useAuthStore } from './store';

/**
 * This hook provides authentication functionality.
 * It may be easier to use the `useAuthModal` or `useRequireAuth` hooks
 * instead as those will also handle showing authentication to the user
 * directly.
 */
export const useAuth = () => {
  const { isReady, auth, session, initialize, signOut: storeSignOut, setAuth } = useAuthStore();
  const { isOpen, close, open } = useAuthModal();

  const initiate = useCallback(() => {
    console.log('Auth initiate called');
    initialize();
  }, [initialize]);

  useEffect(() => {
    // Initialize auth on mount
    if (!isReady) {
      initiate();
    }
  }, [initiate, isReady]);

  const signIn = useCallback(() => {
    open({ mode: 'signin' });
  }, [open]);

  const signUp = useCallback(() => {
    open({ mode: 'signup' });
  }, [open]);

  const signOut = useCallback(async () => {
    const { error } = await storeSignOut();
    if (!error) {
      close();
      router.replace('/auth');
    }
    return { error };
  }, [storeSignOut, close]);

  return {
    isReady,
    isAuthenticated: isReady ? !!auth : null,
    signIn,
    signOut,
    signUp,
    auth,
    setAuth,
    session,
    initiate,
  };
};

/**
 * This hook will automatically open the authentication modal if the user is not authenticated.
 */
export const useRequireAuth = (options) => {
  const { isAuthenticated, isReady } = useAuth();
  const { open } = useAuthModal();

  useEffect(() => {
    if (!isAuthenticated && isReady) {
      open({ mode: options?.mode });
    }
  }, [isAuthenticated, open, options?.mode, isReady]);
};

export default useAuth;