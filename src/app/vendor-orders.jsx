import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { 
  ArrowLeft,
  Filter,
  Search,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Phone,
  MapPin,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/utils/auth/useAuth';
import vendorService from '@/lib/vendorService';

export default function VendorOrdersScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors, statusBarStyle } = useTheme();
  const { auth } = useAuth();
  const [selectedFilter, setSelectedFilter] = useState('all');
  
  // State for real data
  const [orders, setOrders] = useState([]);
  const [vendorProfile, setVendorProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updating, setUpdating] = useState({});
  const [error, setError] = useState(null);

  // Load vendor data and orders
  const loadOrders = async () => {
    try {
      // Support both auth shapes: some hooks return auth.id, others set auth.user.id
      const userId = auth?.id ?? auth?.user?.id;
      if (!userId) {
        setVendorProfile(null);
        setOrders([]);
        return;
      }

      setError(null);
      try { console.debug('[VendorOrders] loading for userId=', userId); } catch (e) {}

      // Get vendor profile first
      const profileResult = await vendorService.getVendorProfile(userId);
      if (profileResult.error) {
        console.warn('[VendorOrders] failed to load vendor profile', profileResult.error);
        throw profileResult.error;
      }

      setVendorProfile(profileResult.data);

      // Get orders for this vendor
      const vendorId = profileResult.data?.id;
      if (!vendorId) {
        try { console.debug('[VendorOrders] no vendor profile found for user', userId); } catch (e) {}
        setOrders([]);
        return;
      }

      const ordersResult = await vendorService.getVendorOrders(vendorId, {
        status: selectedFilter === 'all' ? null : selectedFilter
      });
      if (ordersResult.error) {
        console.warn('[VendorOrders] failed to load orders', ordersResult.error);
        throw ordersResult.error;
      }

      try { console.debug('[VendorOrders] orders fetched', { vendorId, count: (ordersResult.data || []).length }); } catch (e) {}
      setOrders(ordersResult.data || []);
    } catch (error) {
      console.error('Error loading orders:', error);
      setError(error?.message || String(error));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [auth?.user?.id, auth?.id, selectedFilter]);


  if (!loading && !vendorProfile) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 18, marginBottom: 8 }}>Vendor profile not set up</Text>
        <Text style={{ color: colors.textSecondary, textAlign: 'center', marginBottom: 16 }}>You don't have a vendor profile yet. Set up your business details to start receiving orders.</Text>
        <TouchableOpacity
          style={{ backgroundColor: colors.primary, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8 }}
          onPress={() => router.push('/vendor-settings')}
        >
          <Text style={{ color: 'white', fontFamily: 'Inter_500Medium' }}>Set up profile</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const onRefresh = async () => {
    setRefreshing(true);
    await loadOrders();
  };

  // Helper function to format relative time
  const formatRelativeTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return `${Math.floor(diffMins / 1440)}d ago`;
  };

  // Calculate filter counts
  const filters = [
    { id: 'all', name: 'All Orders', count: orders.length },
    { id: 'pending', name: 'Pending', count: orders.filter(o => o.status === 'pending').length },
    { id: 'confirmed', name: 'Confirmed', count: orders.filter(o => o.status === 'confirmed').length },
    { id: 'preparing', name: 'Preparing', count: orders.filter(o => o.status === 'preparing').length },
    { id: 'ready', name: 'Ready', count: orders.filter(o => o.status === 'ready').length },
    { id: 'delivered', name: 'Delivered', count: orders.filter(o => o.status === 'delivered').length },
  ];

  const getStatusInfo = (status) => {
    switch (status) {
      case 'pending':
        return { color: '#FF9500', icon: AlertCircle, label: 'Pending' };
      case 'confirmed':
        return { color: '#007AFF', icon: Clock, label: 'Confirmed' };
      case 'preparing':
        return { color: '#007AFF', icon: Clock, label: 'Preparing' };
      case 'ready':
        return { color: '#34C759', icon: CheckCircle, label: 'Ready' };
      case 'out_for_delivery':
        return { color: '#FF9500', icon: Clock, label: 'Out for Delivery' };
      case 'delivered':
        return { color: colors.textSecondary, icon: CheckCircle, label: 'Delivered' };
      case 'cancelled':
        return { color: '#FF3B30', icon: XCircle, label: 'Cancelled' };
      default:
        return { color: colors.textSecondary, icon: AlertCircle, label: 'Unknown' };
    }
  };

  const filteredOrders = selectedFilter === 'all' 
    ? orders 
    : orders.filter(order => order.status === selectedFilter);

  const handleStatusUpdate = async (orderId, newStatus) => {
    if (!vendorProfile?.id) return;
    
    try {
      setUpdating(prev => ({ ...prev, [orderId]: true }));
      
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      Alert.alert(
        'Update Order Status',
        `Mark order ${orderId} as ${newStatus}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Confirm', 
            onPress: async () => {
              const result = await vendorService.updateOrderStatus(orderId, newStatus, vendorProfile.id);
              if (result.error) {
                Alert.alert('Error', 'Failed to update order status');
              } else {
                // Refresh orders to show updated status
                await loadOrders();
              }
            }
          }
        ]
      );
    } finally {
      setUpdating(prev => ({ ...prev, [orderId]: false }));
    }
  };

  const handleCallCustomer = async (phone) => {
    await Haptics.selectionAsync();
    Alert.alert(
      'Call Customer',
      `Call ${phone}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Call', onPress: () => console.log(`Calling ${phone}`) }
      ]
    );
  };

  const renderFilterTab = (filter) => (
    <TouchableOpacity
      key={filter.id}
      onPress={() => setSelectedFilter(filter.id)}
      style={{
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: selectedFilter === filter.id ? colors.primary : colors.surface,
        borderRadius: 20,
        marginRight: 12,
      }}
    >
      <Text style={{
        fontFamily: 'Inter_500Medium',
        fontSize: 14,
        color: selectedFilter === filter.id ? '#fff' : colors.text,
      }}>
        {filter.name} ({filter.count})
      </Text>
    </TouchableOpacity>
  );

  const renderOrderCard = ({ item: order }) => {
    const statusInfo = getStatusInfo(order.status);
    const StatusIcon = statusInfo.icon;

    return (
      <View style={{
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
      }}>
        {/* Order Header */}
        <View style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 16,
        }}>
          <View style={{ flex: 1 }}>
            <Text style={{
              fontFamily: 'Inter_600SemiBold',
              fontSize: 16,
              color: colors.text,
              marginBottom: 4,
            }}>
              {order.order_number || `Order #${order.id}`}
            </Text>
            <Text style={{
              fontFamily: 'Inter_500Medium',
              fontSize: 14,
              color: colors.text,
              marginBottom: 2,
            }}>
              {order.users?.full_name || 'Customer'}
            </Text>
            <Text style={{
              fontFamily: 'Inter_400Regular',
              fontSize: 12,
              color: colors.textSecondary,
            }}>
              {formatRelativeTime(order.created_at)}
            </Text>
          </View>

          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: statusInfo.color + '20',
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 16,
          }}>
            <StatusIcon size={14} color={statusInfo.color} />
            <Text style={{
              fontFamily: 'Inter_500Medium',
              fontSize: 12,
              color: statusInfo.color,
              marginLeft: 4,
            }}>
              {statusInfo.label}
            </Text>
          </View>
        </View>

        {/* Order Items */}
        <View style={{ marginBottom: 16 }}>
          {(order.order_items || []).map((item, index) => (
            <View key={index} style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              marginBottom: 4,
            }}>
              <Text style={{
                fontFamily: 'Inter_400Regular',
                fontSize: 14,
                color: colors.text,
                flex: 1,
              }}>
                {item.quantity}x {item.menu_items?.name || 'Item'}
              </Text>
              <Text style={{
                fontFamily: 'Inter_500Medium',
                fontSize: 14,
                color: colors.text,
              }}>
                ₵{(parseFloat(item.menu_items?.price || 0) * item.quantity).toFixed(2)}
              </Text>
            </View>
          ))}
          
          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginTop: 8,
            paddingTop: 8,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}>
            <Text style={{
              fontFamily: 'Inter_600SemiBold',
              fontSize: 16,
              color: colors.text,
            }}>
              Total
            </Text>
            <Text style={{
              fontFamily: 'Inter_600SemiBold',
              fontSize: 16,
              color: colors.primary,
            }}>
              ₵{parseFloat(order.total_amount || 0).toFixed(2)}
            </Text>
          </View>
        </View>

        {/* Delivery Info */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          marginBottom: 12,
        }}>
          <MapPin size={16} color={colors.textSecondary} style={{ marginTop: 2, marginRight: 8 }} />
          <Text style={{
            fontFamily: 'Inter_400Regular',
            fontSize: 14,
            color: colors.textSecondary,
            flex: 1,
          }}>
            {order.delivery_address || 'No delivery address provided'}
          </Text>
        </View>

        {order.special_instructions && (
          <View style={{
            backgroundColor: colors.primary + '10',
            padding: 12,
            borderRadius: 8,
            marginBottom: 16,
          }}>
            <Text style={{
              fontFamily: 'Inter_400Regular',
              fontSize: 14,
              color: colors.text,
            }}>
              Special: {order.special_instructions}
            </Text>
          </View>
        )}

        {/* Action Buttons */}
        <View style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
        }}>
          <TouchableOpacity
            onPress={() => handleCallCustomer(order.users?.phone)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: colors.primary + '15',
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderRadius: 8,
              opacity: order.users?.phone ? 1 : 0.5,
            }}
            disabled={!order.users?.phone}
          >
            <Phone size={16} color={colors.primary} />
            <Text style={{
              fontFamily: 'Inter_500Medium',
              fontSize: 14,
              color: colors.primary,
              marginLeft: 6,
            }}>
              Call
            </Text>
          </TouchableOpacity>

          {order.status !== 'delivered' && order.status !== 'cancelled' && (
            <TouchableOpacity
              onPress={() => {
                const nextStatus = 
                  order.status === 'pending' ? 'confirmed' :
                  order.status === 'confirmed' ? 'preparing' :
                  order.status === 'preparing' ? 'ready' :
                  order.status === 'ready' ? 'out_for_delivery' :
                  order.status === 'out_for_delivery' ? 'delivered' : 'delivered';
                handleStatusUpdate(order.id, nextStatus);
              }}
              style={{
                backgroundColor: updating[order.id] ? colors.textSecondary : colors.primary,
                paddingHorizontal: 20,
                paddingVertical: 8,
                borderRadius: 8,
              }}
              disabled={updating[order.id]}
            >
              {updating[order.id] ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={{
                  fontFamily: 'Inter_500Medium',
                  fontSize: 14,
                  color: '#fff',
                }}>
                  {order.status === 'pending' ? 'Confirm Order' :
                   order.status === 'confirmed' ? 'Start Preparing' :
                   order.status === 'preparing' ? 'Mark Ready' :
                   order.status === 'ready' ? 'Out for Delivery' :
                   order.status === 'out_for_delivery' ? 'Mark Delivered' : 'Update'}
                </Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

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
            paddingBottom: 20,
            backgroundColor: colors.background,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 16,
          }}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: colors.surface,
                justifyContent: 'center',
                alignItems: 'center',
                marginRight: 16,
              }}
            >
              <ArrowLeft size={20} color={colors.text} />
            </TouchableOpacity>

            <Text style={{
              fontFamily: 'Inter_600SemiBold',
              fontSize: 24,
              color: colors.text,
              flex: 1,
            }}>
              Orders
            </Text>
          </View>
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
            Loading your orders...
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
            paddingBottom: 20,
            backgroundColor: colors.background,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 16,
          }}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: colors.surface,
                justifyContent: 'center',
                alignItems: 'center',
                marginRight: 16,
              }}
            >
              <ArrowLeft size={20} color={colors.text} />
            </TouchableOpacity>

            <Text style={{
              fontFamily: 'Inter_600SemiBold',
              fontSize: 24,
              color: colors.text,
              flex: 1,
            }}>
              Orders
            </Text>
          </View>
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
            Error Loading Orders
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
            onPress={loadOrders}
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
          paddingBottom: 20,
          backgroundColor: colors.background,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          marginBottom: 16,
        }}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: colors.surface,
              justifyContent: 'center',
              alignItems: 'center',
              marginRight: 16,
            }}
          >
            <ArrowLeft size={20} color={colors.text} />
          </TouchableOpacity>

          <Text style={{
            fontFamily: 'Inter_600SemiBold',
            fontSize: 24,
            color: colors.text,
            flex: 1,
          }}>
            Orders
          </Text>

          <TouchableOpacity
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: colors.surface,
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Search size={20} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Filter Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingRight: 24 }}
        >
          {filters.map(renderFilterTab)}
        </ScrollView>
      </View>

      {/* Orders List */}
      <FlatList
        data={filteredOrders}
        renderItem={renderOrderCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          padding: 24,
          paddingBottom: insets.bottom + 32,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={() => (
          <View style={{
            backgroundColor: colors.surface,
            borderRadius: 16,
            padding: 40,
            alignItems: 'center',
            marginTop: 40,
          }}>
            <AlertCircle size={48} color={colors.textSecondary} />
            <Text style={{
              fontFamily: 'Inter_500Medium',
              fontSize: 18,
              color: colors.textSecondary,
              marginTop: 16,
              textAlign: 'center',
            }}>
              No orders found
            </Text>
            <Text style={{
              fontFamily: 'Inter_400Regular',
              fontSize: 14,
              color: colors.textSecondary,
              marginTop: 8,
              textAlign: 'center',
            }}>
              Orders matching your filter will appear here
            </Text>
          </View>
        )}
      />
    </View>
  );
}