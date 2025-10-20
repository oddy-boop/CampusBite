import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Animated,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Image } from 'expo-image';
import { 
  Clock, 
  CheckCircle, 
  XCircle, 
  Package, 
  ChevronRight,
  RefreshCw,
  ShoppingBag,
  MapPin,
  Calendar
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/utils/auth/useAuth';
import { useCart } from '@/contexts/CartContext';
import { getCustomerOrders, cancelOrder } from '@/lib/customerService';
import notificationService from '@/lib/notificationService';

export default function OrdersScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors, statusBarStyle } = useTheme();
  const { auth } = useAuth();
  const { formatPrice } = useCart();
  const [selectedTab, setSelectedTab] = useState('active');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [orders, setOrders] = useState([]);
  const [cancelling, setCancelling] = useState({});
  const scrollY = useRef(new Animated.Value(0)).current;

  const headerHeight = 140;
  const [unreadCount, setUnreadCount] = useState(0);

  // Load orders from database
  const loadOrders = async () => {
    if (!auth?.id) {
      setLoading(false);
      setOrders([]);
      return;
    }

    try {
      setError(null);
      const { data, error: fetchError } = await getCustomerOrders(auth.id);

      if (fetchError) {
        throw fetchError;
      }

      // Merge cached recent order from checkout if present so the user sees their new order immediately
      try {
        const cached = await AsyncStorage.getItem('@campusbite_recent_order');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed?.customer_id === auth.id && !((data || []).find(o => o.id === parsed.id))) {
            (data || []).unshift(parsed);
            await AsyncStorage.removeItem('@campusbite_recent_order');
          }
        }
      } catch (cacheErr) {
        console.warn('[OrdersScreen] failed to merge cached order', cacheErr);
      }

      try { console.debug('[OrdersScreen] loadOrders result', { count: (data || []).length }); } catch (e) {}
      setOrders(data || []);
    } catch (err) {
      console.error('Error loading orders:', err);
      setError(err.message || 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const isFocused = useIsFocused();

  // Reload orders when the authenticated user changes or when the screen becomes focused
  useEffect(() => {
    loadOrders();
    // Load unread notifications count for this user
    (async () => {
      try {
        if (auth?.id) {
          const { data } = await notificationService.getUnread(auth.id);
          setUnreadCount((data || []).length);
        }
      } catch (e) {}
    })();
  }, [auth?.id, isFocused]);

  const getStatusConfig = (status) => {
    switch (status) {
      case 'pending':
        return {
          color: colors.textSecondary,
          icon: <Clock size={16} color={colors.textSecondary} />,
          text: 'Pending',
          bgColor: colors.textSecondary + '10',
        };
      case 'confirmed':
        return {
          color: colors.primary,
          icon: <CheckCircle size={16} color={colors.primary} />,
          text: 'Confirmed',
          bgColor: colors.primary + '10',
        };
      case 'preparing':
        return {
          color: colors.warning,
          icon: <Clock size={16} color={colors.warning} />,
          text: 'Preparing',
          bgColor: colors.warning + '20',
        };
      case 'ready':
        return {
          color: colors.secondary,
          icon: <Package size={16} color={colors.secondary} />,
          text: 'Ready for Pickup',
          bgColor: colors.secondary + '20',
        };
      case 'out_for_delivery':
        return {
          color: colors.primary,
          icon: <Package size={16} color={colors.primary} />,
          text: 'Out for Delivery',
          bgColor: colors.primary + '10',
        };
      case 'completed':
        return {
          color: colors.success,
          icon: <CheckCircle size={16} color={colors.success} />,
          text: 'Completed',
          bgColor: colors.success + '20',
        };
      case 'cancelled':
        return {
          color: colors.error,
          icon: <XCircle size={16} color={colors.error} />,
          text: 'Cancelled',
          bgColor: colors.error + '20',
        };
      case 'delivered':
        return {
          color: colors.success,
          icon: <CheckCircle size={16} color={colors.success} />,
          text: 'Delivered',
          bgColor: colors.success + '10',
        };
      default:
        return {
          color: colors.textSecondary,
          icon: <Clock size={16} color={colors.textSecondary} />,
          text: 'Unknown',
          bgColor: colors.textSecondary + '20',
        };
    }
  };

  const filterOrders = (orders, tab) => {
    switch (tab) {
      case 'active':
        // Active includes pending/confirmed orders as well as preparing/ready/out_for_delivery
        return orders.filter(order => ['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery'].includes(order.status));
      case 'completed':
        return orders.filter(order => order.status === 'completed');
      case 'cancelled':
        return orders.filter(order => order.status === 'cancelled');
      default:
        return orders;
    }
  };

  const filteredOrders = filterOrders(orders, selectedTab);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    
    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
      });
    }
  };

  const handleTabPress = async (tab) => {
    await Haptics.selectionAsync();
    setSelectedTab(tab);
  };

  const handleOrderPress = async (order) => {
    await Haptics.selectionAsync();
    Alert.alert(
      `Order ${order.order_number}`,
  `Status: ${getStatusConfig(order.status).text}\nVendor: ${order.vendor_profiles?.business_name || 'Vendor'}\nTotal: ${formatPrice(order.total_amount ?? order.total ?? order.totalAmount ?? 0)}`,
      [
        { text: 'Close', style: 'cancel' },
        ...(order.status === 'completed' ? [{ 
          text: 'Reorder', 
          onPress: () => console.log('Reorder items') 
        }] : []),
        ...(order.status === 'ready' ? [{ 
          text: 'Mark as Picked Up', 
          onPress: () => console.log('Mark as picked up') 
        }] : []),
      ]
    );
  };

  const handleReorderAll = async (order) => {
    await Haptics.selectionAsync();
    Alert.alert(
      'Reorder Items',
      `Add all items from this order to your cart?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Add to Cart', 
          onPress: () => {
            // In real app, this would add items to cart
            console.log('Adding items to cart:', order.items);
            Alert.alert('Success', 'Items added to cart!');
          }
        },
      ]
    );
  };

  const handleCancelOrder = async (order) => {
    if (!auth?.id) {
      Alert.alert('Sign In Required', 'Please sign in to cancel an order.');
      return;
    }

    if (!order || !order.id) return;

    Alert.alert(
      'Cancel Order',
      `Are you sure you want to cancel order ${order.order_number || order.id}?`,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes',
          onPress: async () => {
            try {
              setCancelling(prev => ({ ...prev, [order.id]: true }));
              const { data, error } = await cancelOrder(order.id, auth.id);
              if (error) {
                console.error('Cancel order error:', error);
                Alert.alert('Cancel Failed', error.message || String(error));
              } else {
                // Optimistically update UI
                setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: 'cancelled' } : o));
                Alert.alert('Order Cancelled', 'Your order has been cancelled.');
              }
            } catch (e) {
              console.error('Cancel order exception:', e);
              Alert.alert('Error', 'Failed to cancel order. Please try again.');
            } finally {
              setCancelling(prev => ({ ...prev, [order.id]: false }));
            }
          }
        }
      ]
    );
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadOrders();
    setRefreshing(false);
  };

  const renderOrderCard = (order) => {
    const statusConfig = getStatusConfig(order.status);
    
    return (
      <TouchableOpacity
        key={order.id}
        style={{
          backgroundColor: colors.surface,
          borderRadius: 16,
          marginBottom: 16,
          overflow: 'hidden',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          elevation: 3,
        }}
        onPress={() => handleOrderPress(order)}
      >
        {/* Order Header */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          padding: 16,
          borderBottomWidth: 1,
          borderBottomColor: colors.separator,
        }}>
          <Image
            source={{ uri: order.vendor_profiles?.logo_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=100' }}
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              marginRight: 12,
            }}
            contentFit="cover"
            transition={200}
          />
          
          <View style={{ flex: 1 }}>
            <Text style={{
              fontFamily: 'Inter_600SemiBold',
              fontSize: 16,
              color: colors.text,
              marginBottom: 4,
            }}>
              {order.vendor_profiles?.business_name || 'Vendor'}
            </Text>
            <Text style={{
              fontFamily: 'Inter_400Regular',
              fontSize: 14,
              color: colors.textSecondary,
            }}>
              Order {order.order_number} • {formatDate(order.created_at)}
            </Text>
          </View>

          <View style={{
            backgroundColor: statusConfig.bgColor,
            borderRadius: 8,
            paddingHorizontal: 8,
            paddingVertical: 4,
            flexDirection: 'row',
            alignItems: 'center',
          }}>
            {statusConfig.icon}
            <Text style={{
              fontFamily: 'Inter_500Medium',
              fontSize: 12,
              color: statusConfig.color,
              marginLeft: 4,
            }}>
              {statusConfig.text}
            </Text>
          </View>
        </View>

        {/* Order Details */}
        <View style={{ padding: 16 }}>
          {/* Items */}
          <View style={{ marginBottom: 12 }}>
            {order.order_items && order.order_items.length > 0 ? (
              order.order_items.map((item, index) => (
              <Text
                key={index}
                style={{
                  fontFamily: 'Inter_400Regular',
                  fontSize: 14,
                  color: colors.text,
                  marginBottom: 2,
                }}
              >
                {item.quantity}x {item.menu_items?.name || 'Item'}
              </Text>
            ))
            ) : (
              <Text style={{
                fontFamily: 'Inter_400Regular',
                fontSize: 14,
                color: colors.textSecondary,
              }}>
                No items
              </Text>
            )}
          </View>

          {/* Order Info */}
          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: order.estimatedReady ? 12 : 0,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Calendar size={14} color={colors.textSecondary} />
              <Text style={{
                fontFamily: 'Inter_400Regular',
                fontSize: 14,
                color: colors.textSecondary,
                marginLeft: 4,
              }}>
                Pickup: {order.pickupTime}
              </Text>
            </View>

            <Text style={{
              fontFamily: 'Inter_600SemiBold',
              fontSize: 16,
              color: colors.primary,
            }}>
              {formatPrice(order.total_amount ?? order.total ?? order.totalAmount ?? 0)}
            </Text>
          </View>

          {/* Estimated Ready Time */}
          {order.estimatedReady && (
            <View style={{
              backgroundColor: colors.primaryMuted,
              borderRadius: 8,
              padding: 12,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Clock size={16} color={colors.primary} />
                <Text style={{
                  fontFamily: 'Inter_500Medium',
                  fontSize: 14,
                  color: colors.primary,
                  marginLeft: 8,
                }}>
                  Ready in {order.estimatedReady}
                </Text>
              </View>
            </View>
          )}

          {/* Action Buttons */}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {(order.status === 'completed') && (
              <TouchableOpacity
                style={{
                  backgroundColor: colors.primary,
                  borderRadius: 8,
                  paddingVertical: 10,
                  alignItems: 'center',
                  marginTop: 12,
                  paddingHorizontal: 16,
                }}
                onPress={() => handleReorderAll(order)}
              >
                <Text style={{
                  fontFamily: 'Inter_500Medium',
                  fontSize: 14,
                  color: 'white',
                }}>
                  Reorder
                </Text>
              </TouchableOpacity>
            )}

            {(!['delivered', 'cancelled'].includes(order.status)) && (
              <TouchableOpacity
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: 8,
                  paddingVertical: 10,
                  alignItems: 'center',
                  marginTop: 12,
                  paddingHorizontal: 16,
                  borderWidth: 1,
                  borderColor: colors.border,
                  marginRight: 8,
                }}
                onPress={() => handleCancelOrder(order)}
                disabled={!!cancelling[order.id]}
              >
                <Text style={{
                  fontFamily: 'Inter_500Medium',
                  fontSize: 14,
                  color: cancelling[order.id] ? colors.textSecondary : colors.error,
                }}>
                  {cancelling[order.id] ? 'Cancelling...' : 'Cancel'}
                </Text>
              </TouchableOpacity>
            )}

            {/* Call Vendor button - customers can call the vendor's business phone */}
            {order.vendor_profiles?.business_phone && (
              <TouchableOpacity
                style={{
                  backgroundColor: colors.primary,
                  borderRadius: 8,
                  paddingVertical: 10,
                  alignItems: 'center',
                  marginTop: 12,
                  paddingHorizontal: 16,
                }}
                onPress={async () => {
                  await Haptics.selectionAsync();
                  const phone = order.vendor_profiles.business_phone;
                  const tel = `tel:${phone}`;
                  const supported = await Linking.canOpenURL(tel);
                  if (supported) {
                    Linking.openURL(tel);
                  } else {
                    Alert.alert('Cannot Call', 'This device cannot make phone calls');
                  }
                }}
              >
                <Text style={{
                  fontFamily: 'Inter_500Medium',
                  fontSize: 14,
                  color: 'white',
                }}>
                  Call Vendor
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={{
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingTop: 60,
    }}>
      <View style={{
        width: 100,
        height: 100,
        backgroundColor: colors.primaryMuted,
        borderRadius: 50,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
      }}>
        <ShoppingBag size={40} color={colors.primary} />
      </View>
      
      <Text style={{
        fontFamily: 'Inter_600SemiBold',
        fontSize: 20,
        color: colors.text,
        marginBottom: 8,
        textAlign: 'center',
      }}>
        No {selectedTab} orders
      </Text>
      
      <Text style={{
        fontFamily: 'Inter_400Regular',
        fontSize: 16,
        color: colors.textSecondary,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 32,
      }}>
        {selectedTab === 'active' 
          ? "You don't have any active orders right now"
          : selectedTab === 'completed' 
          ? "You haven't completed any orders yet"
          : "You don't have any cancelled orders"
        }
      </Text>

      {selectedTab !== 'completed' && selectedTab !== 'cancelled' && (
        <TouchableOpacity
          style={{
            backgroundColor: colors.primary,
            borderRadius: 12,
            paddingHorizontal: 32,
            paddingVertical: 16,
          }}
          onPress={() => router.push('/(tabs)/home')}
        >
          <Text style={{
            fontFamily: 'Inter_600SemiBold',
            fontSize: 16,
            color: 'white',
          }}>
            Browse Vendors
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={statusBarStyle} />

      {/* Fixed Header */}
      <Animated.View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1000,
          backgroundColor: colors.background,
          paddingTop: insets.top,
          borderBottomWidth: scrollY.interpolate({
            inputRange: [0, 1],
            outputRange: [0, 1],
            extrapolate: 'clamp',
          }),
          borderBottomColor: colors.separator,
        }}
      >
        <View style={{ paddingHorizontal: 24, paddingBottom: 16 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{
            fontFamily: 'Inter_600SemiBold',
            fontSize: 28,
            color: colors.text,
            marginBottom: 20,
            }}>
              Orders
            </Text>
            <TouchableOpacity onPress={() => router.push('/notifications')} style={{ padding: 8 }}>
              <Text style={{ color: colors.primary }}>{unreadCount > 0 ? `${unreadCount} new` : 'Notifications'}</Text>
            </TouchableOpacity>
          </View>

          {/* Tab Navigation */}
          <View style={{
            flexDirection: 'row',
            backgroundColor: colors.surface,
            borderRadius: 12,
            padding: 4,
          }}>
            {[
              { id: 'active', label: 'Active' },
              { id: 'completed', label: 'Completed' },
              { id: 'cancelled', label: 'Cancelled' },
            ].map((tab) => (
              <TouchableOpacity
                key={tab.id}
                style={{
                  flex: 1,
                  backgroundColor: selectedTab === tab.id ? colors.primary : 'transparent',
                  borderRadius: 8,
                  paddingVertical: 8,
                  alignItems: 'center',
                }}
                onPress={() => handleTabPress(tab.id)}
              >
                <Text style={{
                  fontFamily: 'Inter_500Medium',
                  fontSize: 14,
                  color: selectedTab === tab.id ? 'white' : colors.text,
                }}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Animated.View>

      {/* Content */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: insets.top + headerHeight + 20,
          paddingHorizontal: 24,
          paddingBottom: insets.bottom + 20,
          flexGrow: 1,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
      >
        {/* Loading State */}
        {loading && !refreshing && (
          <View style={{ alignItems: 'center', paddingTop: 60 }}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={{
              fontFamily: 'Inter_400Regular',
              fontSize: 14,
              color: colors.textSecondary,
              marginTop: 12,
            }}>
              Loading orders...
            </Text>
          </View>
        )}

        {/* Error State */}
        {error && !loading && (
          <View style={{ alignItems: 'center', paddingTop: 40 }}>
            <Text style={{ fontSize: 48, marginBottom: 16 }}>😕</Text>
            <Text style={{
              fontFamily: 'Inter_500Medium',
              fontSize: 18,
              color: colors.text,
              marginBottom: 8,
            }}>
              Failed to load orders
            </Text>
            <Text style={{
              fontFamily: 'Inter_400Regular',
              fontSize: 14,
              color: colors.textSecondary,
              textAlign: 'center',
              marginBottom: 20,
            }}>
              {error}
            </Text>
            <TouchableOpacity
              style={{
                backgroundColor: colors.primary,
                paddingHorizontal: 24,
                paddingVertical: 12,
                borderRadius: 8,
              }}
              onPress={loadOrders}
            >
              <Text style={{
                fontFamily: 'Inter_500Medium',
                fontSize: 14,
                color: 'white',
              }}>
                Try Again
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Orders List */}
        {!loading && !error && (
        filteredOrders.length > 0 ? (
          filteredOrders.map(renderOrderCard)
        ) : (
          renderEmptyState()
        )
        )}
      </ScrollView>
    </View>
  );
}