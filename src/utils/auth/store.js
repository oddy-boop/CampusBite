import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

export const authKey = `${process.env.EXPO_PUBLIC_PROJECT_GROUP_ID || 'campusbite'}-jwt`;

/**
 * This store manages the authentication state of the application.
 */
export const useAuthStore = create((set, get) => ({
  isReady: false,
  auth: null,
  session: null,
  setAuth: (auth) => {
    set({ auth });
  },
  setSession: (session) => {
    set({ session, auth: session?.user || null });
  },
  setReady: (isReady) => {
    set({ isReady });
  },
  // Initialize auth state from Supabase
  initialize: async () => {
    try {
      // Get initial session
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) {
        console.error('Error getting session:', error);
        set({ isReady: true, session: null, auth: null });
        return;
      }

      if (session?.user) {
        // Get user profile data
        const { data: userProfile, error: profileError } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (profileError) {
          console.error('Error fetching user profile:', profileError);
        }

        const authData = {
          ...session.user,
          ...userProfile,
          token: session.access_token,
        };

        set({ 
          isReady: true, 
          session, 
          auth: authData 
        });
      } else {
        set({ isReady: true, session: null, auth: null });
      }
    } catch (error) {
      console.error('Auth initialization error:', error);
      set({ isReady: true, session: null, auth: null });
    }
  },
  // Sign out user
  signOut: async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Error signing out:', error);
        return { error };
      }
      set({ session: null, auth: null });
      return { error: null };
    } catch (error) {
      console.error('Sign out error:', error);
      return { error };
    }
  },
}));

/**
 * This store manages the state of the authentication modal.
 */
export const useAuthModal = create((set) => ({
  isOpen: false,
  mode: 'signup',
  open: (options) => set({ isOpen: true, mode: options?.mode || 'signup' }),
  close: () => set({ isOpen: false }),
}));

// Listen to auth changes
supabase.auth.onAuthStateChange((event, session) => {
  console.log('Auth state changed:', event, session?.user?.id);
  
  if (event === 'SIGNED_IN' && session?.user) {
    // Fetch user profile when signed in
    supabase
      .from('users')
      .select('*')
      .eq('id', session.user.id)
      .single()
      .then(({ data: userProfile, error }) => {
        if (error) {
          console.error('Error fetching user profile:', error);
        }

        const authData = {
          ...session.user,
          ...userProfile,
          token: session.access_token,
        };

        useAuthStore.getState().setSession(session);
        useAuthStore.getState().setAuth(authData);
      });
  } else if (event === 'SIGNED_OUT') {
    useAuthStore.getState().setSession(null);
    useAuthStore.getState().setAuth(null);
  }
});