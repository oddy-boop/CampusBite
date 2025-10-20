import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/utils/auth/useAuth';
import notificationService from '@/lib/notificationService';

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { auth } = useAuth();
  const [notifications, setNotifications] = useState([]);

  const load = async () => {
    if (!auth?.id) return;
    const { data } = await notificationService.getUnread(auth.id);
    setNotifications(data || []);
  };

  useEffect(() => { load(); }, [auth?.id]);

  const markRead = async (id) => {
    await notificationService.markAsRead(id);
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  return (
    <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: colors.background }}>
      <FlatList
        data={notifications}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => markRead(item.id)} style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Text style={{ fontFamily: 'Inter_600SemiBold', color: colors.text }}>{item.title}</Text>
            <Text style={{ color: colors.textSecondary }}>{item.message}</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{new Date(item.created_at).toLocaleString()}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}
