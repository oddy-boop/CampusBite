import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Image } from 'expo-image';
import { 
  User, 
  Edit3, 
  History, 
  Settings, 
  Bell, 
  Moon, 
  Sun,
  HelpCircle, 
  MessageCircle, 
  LogOut,
  ChevronRight,
  Shield,
  CreditCard,
  MapPin,
  Phone
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/utils/auth/useAuth';
import { useCart } from '@/contexts/CartContext';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors, statusBarStyle, isDark, toggleTheme } = useTheme();
  const { auth, signOut } = useAuth();
  const { clearCart } = useCart();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  const handleEditProfile = async () => {
    await Haptics.selectionAsync();
    router.push('/profile/edit');
  };

  const handleOrderHistory = async () => {
    await Haptics.selectionAsync();
    router.push('/(tabs)/orders');
  };

  const handleNotificationToggle = async (value) => {
    await Haptics.selectionAsync();
    setNotificationsEnabled(value);
    // In real app, this would update notification preferences
  };

  const handleThemeToggle = async () => {
    await Haptics.selectionAsync();
    toggleTheme();
  };

  const handleSupport = async () => {
    await Haptics.selectionAsync();
    Alert.alert(
      'Contact Support',
      'Choose how you\'d like to contact our support team:',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Email', onPress: () => console.log('Open email') },
        { text: 'Live Chat', onPress: () => console.log('Open chat') },
      ]
    );
  };

  const handleHelp = async () => {
    await Haptics.selectionAsync();
    Alert.alert(
      'Help & FAQ',
      'Visit our help center for frequently asked questions and guides.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Help Center', onPress: () => console.log('Open help') },
      ]
    );
  };

  const handleLogout = async () => {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out of your account?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Sign Out', 
          style: 'destructive',
          onPress: async () => {
            clearCart();
            signOut();
            router.replace('/auth');
          }
        },
      ]
    );
  };

  const renderMenuItem = (icon, title, subtitle, onPress, rightElement) => (
    <TouchableOpacity
      style={{
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        flexDirection: 'row',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
      }}
      onPress={onPress}
    >
      <View style={{
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.primaryMuted,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
      }}>
        {icon}
      </View>
      
      <View style={{ flex: 1 }}>
        <Text style={{
          fontFamily: 'Inter_500Medium',
          fontSize: 16,
          color: colors.text,
          marginBottom: subtitle ? 4 : 0,
        }}>
          {title}
        </Text>
        {subtitle && (
          <Text style={{
            fontFamily: 'Inter_400Regular',
            fontSize: 14,
            color: colors.textSecondary,
          }}>
            {subtitle}
          </Text>
        )}
      </View>
      
      {rightElement || <ChevronRight size={20} color={colors.textSecondary} />}
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={statusBarStyle} />

      {/* Header */}
      <View
        style={{
          paddingTop: insets.top + 16,
          paddingHorizontal: 24,
          paddingBottom: 24,
          backgroundColor: colors.background,
        }}
      >
        <Text style={{
          fontFamily: 'Inter_600SemiBold',
          fontSize: 28,
          color: colors.text,
          marginBottom: 24,
        }}>
          Profile
        </Text>

        {/* User Info Card */}
        <View style={{
          backgroundColor: colors.surface,
          borderRadius: 16,
          padding: 20,
          flexDirection: 'row',
          alignItems: 'center',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          elevation: 3,
        }}>
          {/* Profile Image */}
          <View style={{
            width: 64,
            height: 64,
            borderRadius: 32,
            backgroundColor: colors.primary,
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: 16,
            overflow: 'hidden',
          }}>
            {auth?.avatar_url ? (
              <Image
                source={{ uri: auth.avatar_url }}
                style={{ width: '100%', height: '100%' }}
                contentFit="cover"
              />
            ) : (
              <Text style={{
                fontFamily: 'Inter_600SemiBold',
                fontSize: 24,
                color: 'white',
              }}>
                {auth?.full_name?.charAt(0)?.toUpperCase() || 'U'}
              </Text>
            )}
          </View>

          {/* User Details */}
          <View style={{ flex: 1 }}>
            <Text style={{
              fontFamily: 'Inter_600SemiBold',
              fontSize: 18,
              color: colors.text,
              marginBottom: 4,
            }}>
              {auth?.full_name || 'User Name'}
            </Text>
            <Text style={{
              fontFamily: 'Inter_400Regular',
              fontSize: 14,
              color: colors.textSecondary,
              marginBottom: 2,
            }}>
              Student ID: {auth?.student_id || 'Not set'}
            </Text>
            <Text style={{
              fontFamily: 'Inter_400Regular',
              fontSize: 14,
              color: colors.textSecondary,
            }}>
              {auth?.email || 'user@university.edu'}
            </Text>
          </View>

          {/* Edit Button */}
          <TouchableOpacity
            style={{
              padding: 8,
            }}
            onPress={handleEditProfile}
          >
            <Edit3 size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingBottom: insets.bottom + 20,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Account Section */}
        <View style={{ marginBottom: 32 }}>
          <Text style={{
            fontFamily: 'Inter_600SemiBold',
            fontSize: 18,
            color: colors.text,
            marginBottom: 16,
          }}>
            Account
          </Text>

          {renderMenuItem(
            <History size={20} color={colors.primary} />,
            'Order History',
            'View your past orders and reorder favorites',
            handleOrderHistory
          )}

          {renderMenuItem(
            <CreditCard size={20} color={colors.primary} />,
            'Payment Methods',
            'Manage your payment options',
            () => Alert.alert('Coming Soon', 'Payment management will be available soon!')
          )}

          {renderMenuItem(
            <MapPin size={20} color={colors.primary} />,
            'Saved Addresses',
            'Manage your delivery locations',
            () => Alert.alert('Coming Soon', 'Address management will be available soon!')
          )}
        </View>

        {/* Preferences Section */}
        <View style={{ marginBottom: 32 }}>
          <Text style={{
            fontFamily: 'Inter_600SemiBold',
            fontSize: 18,
            color: colors.text,
            marginBottom: 16,
          }}>
            Preferences
          </Text>

          {renderMenuItem(
            <Bell size={20} color={colors.primary} />,
            'Push Notifications',
            'Order updates and promotions',
            () => handleNotificationToggle(!notificationsEnabled),
            <Switch
              value={notificationsEnabled}
              onValueChange={handleNotificationToggle}
              trackColor={{ false: colors.textMuted, true: colors.primary }}
              thumbColor={'white'}
            />
          )}

          {renderMenuItem(
            isDark ? <Sun size={20} color={colors.primary} /> : <Moon size={20} color={colors.primary} />,
            'Theme',
            isDark ? 'Switch to light mode' : 'Switch to dark mode',
            handleThemeToggle,
            <Switch
              value={isDark}
              onValueChange={handleThemeToggle}
              trackColor={{ false: colors.textMuted, true: colors.primary }}
              thumbColor={'white'}
            />
          )}
        </View>

        {/* Support Section */}
        <View style={{ marginBottom: 32 }}>
          <Text style={{
            fontFamily: 'Inter_600SemiBold',
            fontSize: 18,
            color: colors.text,
            marginBottom: 16,
          }}>
            Support
          </Text>

          {renderMenuItem(
            <HelpCircle size={20} color={colors.primary} />,
            'Help & FAQ',
            'Get answers to common questions',
            handleHelp
          )}

          {renderMenuItem(
            <MessageCircle size={20} color={colors.primary} />,
            'Contact Support',
            'Get help from our support team',
            handleSupport
          )}

          {renderMenuItem(
            <Shield size={20} color={colors.primary} />,
            'Privacy Policy',
            'Learn how we protect your data',
            () => Alert.alert('Coming Soon', 'Privacy policy will be available soon!')
          )}
        </View>

        {/* App Info */}
        <View style={{
          backgroundColor: colors.surface,
          borderRadius: 12,
          padding: 16,
          marginBottom: 24,
          alignItems: 'center',
        }}>
          <View style={{
            width: 48,
            height: 48,
            backgroundColor: colors.primary,
            borderRadius: 24,
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: 12,
          }}>
            <Text style={{
              fontSize: 24,
              fontWeight: 'bold',
              color: 'white'
            }}>
              🍕
            </Text>
          </View>
          
          <Text style={{
            fontFamily: 'Inter_600SemiBold',
            fontSize: 16,
            color: colors.text,
            marginBottom: 4,
          }}>
            CampusBite
          </Text>
          
          <Text style={{
            fontFamily: 'Inter_400Regular',
            fontSize: 14,
            color: colors.textSecondary,
            textAlign: 'center',
          }}>
            Version 1.0.0
          </Text>
        </View>

        {/* Logout Button */}
        <TouchableOpacity
          style={{
            backgroundColor: colors.error,
            borderRadius: 12,
            padding: 16,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 20,
          }}
          onPress={handleLogout}
        >
          <LogOut size={20} color="white" />
          <Text style={{
            fontFamily: 'Inter_600SemiBold',
            fontSize: 16,
            color: 'white',
            marginLeft: 8,
          }}>
            Sign Out
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}