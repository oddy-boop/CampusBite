import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { 
  BarChart3, 
  Package, 
  Clock, 
  DollarSign, 
  ShoppingBag, 
  Settings, 
  TrendingUp,
  Users,
  Calendar,
  ChevronRight,
  Plus,
  Eye
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/utils/auth/useAuth';
import vendorService from '@/lib/vendorService';

const { width: screenWidth } = Dimensions.get('window');

export default function VendorDashboardScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors, statusBarStyle } = useTheme();
  const { auth } = useAuth();
  
  // State for real data
  const [vendorProfile, setVendorProfile] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Load vendor data
  const loadVendorData = async () => {
    try {
      // Support both auth shapes: auth.id or auth.user.id
      const userId = auth?.id ?? auth?.user?.id;
      if (!userId) return;

      setError(null);

      // Get vendor profile (may return null if profile isn't created yet)
      let profileResult = await vendorService.getVendorProfile(userId);
      if (profileResult.error) {
        // Non-fatal: log and continue to attempt analytics where possible
        console.warn('[VendorDashboard] getVendorProfile error', profileResult.error);
      }

      let profile = profileResult.data || null;

      // If we didn't find a profile by id, try to find one by contact info (email/phone)
      if (!profile) {
        try {
          const findResult = await vendorService.findVendorByContact(userId);
          if (findResult.error) {
            console.warn('[VendorDashboard] findVendorByContact error', findResult.error);
          } else if (findResult.data) {
            profile = findResult.data;
            console.debug('[VendorDashboard] auto-linked vendor profile by contact', { vendorId: profile.id });
          }
        } catch (e) {
          console.warn('[VendorDashboard] findVendorByContact exception', e?.message || e);
        }
      }

      setVendorProfile(profile);

      // Determine vendorId to use for analytics: prefer profile.id, fallback to userId
      const vendorIdForAnalytics = profile?.id || userId;

      // Get analytics data (attempt even if profile is missing)
      const analyticsResult = await vendorService.getVendorAnalytics(vendorIdForAnalytics, 'today');
      if (analyticsResult.error) {
        console.warn('[VendorDashboard] getVendorAnalytics error', analyticsResult.error);
      } else {
        setAnalytics(analyticsResult.data);
      }
    } catch (error) {
      console.error('Error loading vendor data:', error);
      setError(error.message || String(error));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const effectiveAuthId = auth?.id ?? auth?.user?.id;
  useEffect(() => {
    loadVendorData();
  }, [effectiveAuthId]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadVendorData();
  };

  // Default stats if no data
  const todayStats = analytics ? {
    orders: analytics.totalOrders || 0,
    revenue: analytics.totalRevenue || 0,
    avgOrderValue: analytics.avgOrderValue || 0,
    newCustomers: analytics.newCustomers || 0
  } : {
    orders: 0,
    revenue: 0,
    avgOrderValue: 0,
    newCustomers: 0
  };

  // Helper function to format relative time
  const formatRelativeTime = (dateString) => {
    if (!dateString) return '—';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)} hr ago`;
    return `${Math.floor(diffMins / 1440)} day ago`;
  };

  // Format recent orders safely
  const recentOrders = (Array.isArray(analytics?.orders) ? analytics.orders : []).map(order => ({
    id: order.id,
    customer: order.users?.full_name || 'Customer',
    items: (order.order_items || []).map(item => item.menu_items?.name).filter(Boolean).join(', ') || 'Order items',
    amount: Number(order.total_amount) || 0,
    status: order.status,
    time: formatRelativeTime(order.created_at)
  }));

  const handleQuickAction = async (action) => {
    await Haptics.selectionAsync();
    // Handle navigation based on action
    switch (action) {
      case 'orders':
        router.push('/vendor-orders');
        break;
      case 'menu':
        router.push('/vendor-menu-management');
        break;
      case 'analytics':
        router.push('/vendor-analytics');
        break;
      case 'settings':
        router.push('/vendor-settings');
        break;
      case 'all-orders':
        router.push('/vendor-orders');
        break;
      default:
        console.log(`Navigate to ${action}`);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'preparing': return '#FF9500';
      case 'ready': return '#34C759';
      case 'delivered': return colors.textSecondary;
      default: return colors.textSecondary;
    }
  };

  const renderStatCard = (icon, value, label, subtitle) => (
    <View style={{
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 20,
      flex: 1,
      marginHorizontal: 4,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    }}>
      <View style={{
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.primary + '20',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
      }}>
        {icon}
      </View>
      <Text style={{
        fontFamily: 'Inter_600SemiBold',
        fontSize: 24,
        color: colors.text,
        marginBottom: 4,
      }}>
        {value}
      </Text>
      <Text style={{
        fontFamily: 'Inter_500Medium',
        fontSize: 14,
        color: colors.text,
        marginBottom: 2,
      }}>
        {label}
      </Text>
      {subtitle && (
        <Text style={{
          fontFamily: 'Inter_400Regular',
          fontSize: 12,
          color: colors.textSecondary,
        }}>
          {subtitle}
        </Text>
      )}
    </View>
  );

  const renderActionButton = (icon, title, subtitle, onPress) => (
    <TouchableOpacity
      onPress={onPress}
      style={{
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
      }}
    >
      <View style={{
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.primary + '15',
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
          marginBottom: 2,
        }}>
          {title}
        </Text>
        <Text style={{
          fontFamily: 'Inter_400Regular',
          fontSize: 14,
          color: colors.textSecondary,
        }}>
          {subtitle}
        </Text>
      </View>
      
      <ChevronRight size={20} color={colors.textSecondary} />
    </TouchableOpacity>
  );

  const renderOrderItem = (order) => (
    <View key={order.id} style={{
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 2,
    }}>
      <View style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 8,
      }}>
        <View style={{ flex: 1 }}>
          <Text style={{
            fontFamily: 'Inter_500Medium',
            fontSize: 16,
            color: colors.text,
            marginBottom: 4,
          }}>
            {order.customer}
          </Text>
          <Text style={{
            fontFamily: 'Inter_400Regular',
            fontSize: 14,
            color: colors.textSecondary,
            marginBottom: 4,
          }}>
            {order.items}
          </Text>
        </View>
        <Text style={{
          fontFamily: 'Inter_600SemiBold',
          fontSize: 16,
          color: colors.text,
        }}>
          ₵{order.amount}
        </Text>
      </View>
      
      <View style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <View style={{
          backgroundColor: getStatusColor(order.status) + '20',
          paddingHorizontal: 8,
          paddingVertical: 4,
          borderRadius: 8,
        }}>
          <Text style={{
            fontFamily: 'Inter_500Medium',
            fontSize: 12,
            color: getStatusColor(order.status),
            textTransform: 'capitalize',
          }}>
            {order.status}
          </Text>
        </View>
        <Text style={{
          fontFamily: 'Inter_400Regular',
          fontSize: 12,
          color: colors.textSecondary,
        }}>
          {order.time}
        </Text>
      </View>
    </View>
  );

  // Loading state
  if (loading) {
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
            marginBottom: 8,
          }}>
            Dashboard
          </Text>
          <Text style={{
            fontFamily: 'Inter_400Regular',
            fontSize: 16,
            color: colors.textSecondary,
          }}>
            Loading your data...
          </Text>
        </View>

        <View style={{ 
          flex: 1, 
          justifyContent: 'center', 
          alignItems: 'center',
          paddingHorizontal: 24 
        }}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{
            fontFamily: 'Inter_400Regular',
            fontSize: 16,
            color: colors.textSecondary,
            marginTop: 16,
            textAlign: 'center',
          }}>
            Fetching your vendor data...
          </Text>
        </View>
      </View>
    );
  }

  // Error state
  if (error) {
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
            marginBottom: 8,
          }}>
            Dashboard
          </Text>
        </View>

        <View style={{ 
          flex: 1, 
          justifyContent: 'center', 
          alignItems: 'center',
          paddingHorizontal: 24 
        }}>
          <Text style={{
            fontFamily: 'Inter_600SemiBold',
            fontSize: 18,
            color: colors.error || '#FF3B30',
            marginBottom: 12,
            textAlign: 'center',
          }}>
            Error Loading Data
          </Text>
          <Text style={{
            fontFamily: 'Inter_400Regular',
            fontSize: 16,
            color: colors.textSecondary,
            marginBottom: 24,
            textAlign: 'center',
          }}>
            {error}
          </Text>
          <TouchableOpacity
            onPress={loadVendorData}
            style={{
              backgroundColor: colors.primary,
              paddingHorizontal: 24,
              paddingVertical: 12,
              borderRadius: 12,
            }}
          >
            <Text style={{
              fontFamily: 'Inter_500Medium',
              fontSize: 16,
              color: '#FFFFFF',
            }}>
              Try Again
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

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
          marginBottom: 8,
        }}>
          Dashboard
        </Text>
        <Text style={{
              fontFamily: 'Inter_400Regular',
              fontSize: 16,
              color: colors.textSecondary,
            }}>
              Welcome back, {vendorProfile?.users?.full_name || auth?.name || 'Vendor'}!
          </Text>
          {!vendorProfile && (
            <View style={{ marginTop: 8 }}>
              <Text style={{ color: colors.textSecondary, marginBottom: 8 }}>It looks like your vendor profile isn't set up yet — that's why dashboard numbers might be empty.</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity onPress={async () => {
                  // Attempt to auto-link by contact info
                  try {
                    setLoading(true);
                    const userId = auth?.id ?? auth?.user?.id;
                    const { data: found, error: findErr } = await vendorService.findVendorByContact(userId);
                    if (findErr) throw findErr;
                    if (found) {
                      setVendorProfile(found);
                      const analyticsResult = await vendorService.getVendorAnalytics(found.id, 'today');
                      if (!analyticsResult.error) setAnalytics(analyticsResult.data);
                      Alert.alert('Linked', 'Your vendor profile was found and linked.');
                    } else {
                      // Create a minimal profile automatically
                      const createResult = await vendorService.createVendorProfile(userId, { business_name: auth?.name || 'My Stall' });
                      if (createResult.error) throw createResult.error;
                      setVendorProfile(createResult.data);
                      const analyticsResult = await vendorService.getVendorAnalytics(createResult.data.id, 'today');
                      if (!analyticsResult.error) setAnalytics(analyticsResult.data);
                      Alert.alert('Profile Created', 'A basic vendor profile was created for you. Please complete your settings.');
                      router.push('/vendor-settings');
                    }
                  } catch (e) {
                    console.error('Auto-link/create profile failed', e);
                    Alert.alert('Error', e.message || 'Failed to link or create profile');
                  } finally {
                    setLoading(false);
                  }
                }} style={{ backgroundColor: colors.primary, padding: 10, borderRadius: 8, marginRight: 8 }}>
                  <Text style={{ color: 'white', fontFamily: 'Inter_500Medium' }}>Auto-link / Create profile</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => router.push('/vendor-settings')} style={{ backgroundColor: colors.surface, padding: 10, borderRadius: 8 }}>
                  <Text style={{ color: colors.text, fontFamily: 'Inter_500Medium' }}>Open Settings</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 32 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        {/* Today's Stats */}
        <View style={{ marginBottom: 32 }}>
          <Text style={{
            fontFamily: 'Inter_600SemiBold',
            fontSize: 18,
            color: colors.text,
            marginBottom: 16,
          }}>
            Today's Overview
          </Text>

          <View style={{
            flexDirection: 'row',
            marginBottom: 16,
            marginHorizontal: -4,
          }}>
            {renderStatCard(
              <ShoppingBag size={20} color={colors.primary} />,
              todayStats.orders.toString(),
              'Orders',
              analytics ? 'Today' : 'No data'
            )}
            {renderStatCard(
              <DollarSign size={20} color={colors.primary} />,
              `₵${todayStats.revenue.toFixed(2)}`,
              'Revenue',
              analytics ? 'Today' : 'No data'
            )}
          </View>

          <View style={{
            flexDirection: 'row',
            marginHorizontal: -4,
          }}>
            {renderStatCard(
              <TrendingUp size={20} color={colors.primary} />,
              `₵${todayStats.avgOrderValue.toFixed(2)}`,
              'Avg Order',
              'Per customer'
            )}
            {renderStatCard(
              <Users size={20} color={colors.primary} />,
              todayStats.newCustomers.toString(),
              'New Customers',
              'Unique today'
            )}
          </View>
        </View>

        {/* Quick Actions */}
        <View style={{ marginBottom: 32 }}>
          <Text style={{
            fontFamily: 'Inter_600SemiBold',
            fontSize: 18,
            color: colors.text,
            marginBottom: 16,
          }}>
            Quick Actions
          </Text>

          {renderActionButton(
            <Eye size={20} color={colors.primary} />,
            'View All Orders',
            'See pending, preparing and completed orders',
            () => handleQuickAction('orders')
          )}

          {renderActionButton(
            <Package size={20} color={colors.primary} />,
            'Manage Menu',
            'Add, edit or remove menu items',
            () => handleQuickAction('menu')
          )}

          {renderActionButton(
            <BarChart3 size={20} color={colors.primary} />,
            'Sales Analytics',
            'View detailed sales reports and trends',
            () => handleQuickAction('analytics')
          )}

          {renderActionButton(
            <Settings size={20} color={colors.primary} />,
            'Restaurant Settings',
            'Operating hours, delivery zones & more',
            () => handleQuickAction('settings')
          )}
        </View>

        {/* Recent Orders */}
        <View style={{ marginBottom: 32 }}>
          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
          }}>
            <Text style={{
              fontFamily: 'Inter_600SemiBold',
              fontSize: 18,
              color: colors.text,
            }}>
              Recent Orders
            </Text>
            <TouchableOpacity onPress={() => handleQuickAction('all-orders')}>
              <Text style={{
                fontFamily: 'Inter_500Medium',
                fontSize: 14,
                color: colors.primary,
              }}>
                View All
              </Text>
            </TouchableOpacity>
          </View>

          {recentOrders.length > 0 ? (
            recentOrders.map(order => renderOrderItem(order))
          ) : (
            <View style={{
              backgroundColor: colors.surface,
              borderRadius: 12,
              padding: 32,
              alignItems: 'center',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.05,
              shadowRadius: 2,
              elevation: 2,
            }}>
              <ShoppingBag size={48} color={colors.textSecondary} />
              <Text style={{
                fontFamily: 'Inter_500Medium',
                fontSize: 16,
                color: colors.textSecondary,
                marginTop: 16,
                textAlign: 'center',
              }}>
                No recent orders
              </Text>
              <Text style={{
                fontFamily: 'Inter_400Regular',
                fontSize: 14,
                color: colors.textSecondary,
                marginTop: 4,
                textAlign: 'center',
              }}>
                New orders will appear here
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}