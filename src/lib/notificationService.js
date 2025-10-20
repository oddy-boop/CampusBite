import { supabase } from '@/lib/supabase';

/**
 * Simple notification service for client-side usage.
 * - getUnread(userId) -> fetch unread notifications
 * - markAsRead(notificationId) -> set is_read=true
 * - subscribe(userId, onInsert) -> subscribe to new notifications for userId
 */

const notificationService = {
  async getUnread(userId) {
    if (!userId) return { data: [], error: null };
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .eq('is_read', false)
        .order('created_at', { ascending: false });
      return { data, error };
    } catch (error) {
      console.error('[notificationService] getUnread error', error);
      return { data: null, error };
    }
  },

  async markAsRead(notificationId) {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId)
        .select()
        .single();
      return { data, error };
    } catch (error) {
      console.error('[notificationService] markAsRead error', error);
      return { data: null, error };
    }
  },

  /**
   * Subscribe to new notifications for the given userId.
   * onInsert receives the new notification row.
   * Returns an object { unsubscribe }.
   */
  subscribe(userId, onInsert) {
    if (!userId || typeof onInsert !== 'function') return { unsubscribe: () => {} };

    // Prefer the v2 channel API if available
    try {
      if (typeof supabase.channel === 'function') {
        const chan = supabase
          .channel(`notifications_user_${userId}`)
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, (payload) => {
            try { onInsert(payload?.new || payload?.record || payload); } catch (e) { console.warn('[notificationService] subscribe callback error', e); }
          })
          .subscribe();

        return {
          unsubscribe: () => {
            try { chan.unsubscribe(); } catch (e) {
              try { supabase.removeChannel?.(chan); } catch (e2) {}
            }
          }
        };
      }
    } catch (e) {
      console.warn('[notificationService] realtime v2 subscription attempt failed', e);
    }

    // Fallback to v1 style subscription
    try {
      const sub = supabase
        .from(`notifications:user_id=eq.${userId}`)
        .on('INSERT', (payload) => {
          try { onInsert(payload?.new || payload?.record || payload); } catch (e) { console.warn('[notificationService] subscribe callback error', e); }
        })
        .subscribe();

      return {
        unsubscribe: () => {
          try { sub.unsubscribe?.(); } catch (e) { try { supabase.removeSubscription?.(sub); } catch (e2) {} }
        }
      };
    } catch (e) {
      console.warn('[notificationService] realtime subscription not available', e);
      return { unsubscribe: () => {} };
    }
  }
};

export default notificationService;
