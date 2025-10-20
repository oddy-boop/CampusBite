import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Animated,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Image } from 'expo-image';
import { Trash2, Plus, Minus, Clock, ShoppingBag } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '@/contexts/ThemeContext';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/utils/auth';
import customerService from '@/lib/customerService';

export default function CartScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors, statusBarStyle } = useTheme();
  const { auth } = useAuth();
  const { 
    items, 
    currentVendor, 
    updateQuantity, 
    removeItem, 
    clearCart, 
    getTotalPrice, 
    getTotalItems, 
    formatPrice 
  } = useCart();
  const [selectedPickupTime, setSelectedPickupTime] = useState('');
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const scrollY = useRef(new Animated.Value(0)).current;

  const headerHeight = 88;

  // Generate pickup time slots (next 2 hours in 15-minute intervals)
  const generatePickupTimes = () => {
    const times = [];
    const now = new Date();
    const startTime = new Date(now.getTime() + 15 * 60000); // 15 minutes from now
    
    for (let i = 0; i < 8; i++) {
      const time = new Date(startTime.getTime() + i * 15 * 60000);
      const hours = time.getHours();
      const minutes = time.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours % 12 || 12;
      const timeString = `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
      times.push({
        id: i,
        time: timeString,
        fullTime: time,
      });
    }
    return times;
  };

  const pickupTimes = generatePickupTimes();

  const handleQuantityChange = async (itemId, vendorId, change) => {
    await Haptics.selectionAsync();
    const item = items.find(i => i.id === itemId && i.vendorId === vendorId);
    if (item) {
      const newQuantity = item.quantity + change;
      updateQuantity(itemId, vendorId, newQuantity);
    }
  };

  const handleRemoveItem = async (itemId, vendorId) => {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      'Remove Item',
      'Are you sure you want to remove this item from your cart?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Remove', 
          style: 'destructive',
          onPress: () => removeItem(itemId, vendorId)
        },
      ]
    );
  };

  const handleClearCart = async () => {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      'Clear Cart',
      'Are you sure you want to remove all items from your cart?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Clear', 
          style: 'destructive',
          onPress: () => clearCart()
        },
      ]
    );
  };

  const handleContinueToCheckout = async () => {
    if (!selectedPickupTime) {
      Alert.alert('Select Pickup Time', 'Please select a pickup time to continue.');
      return;
    }

    if (items.length === 0) {
      Alert.alert('Empty Cart', 'Your cart is empty. Add some items first!');
      return;
    }

    if (!auth?.id) {
      Alert.alert('Sign In Required', 'Please sign in to place an order.');
      return;
    }

    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    setIsCheckingOut(true);

    try {
      // Calculate total amount (subtotal + service fee)
      const subtotal = getTotalPrice();
      const serviceFee = 2.00;
      const totalAmount = subtotal + serviceFee;

      // Prepare order data
      const orderData = {
        vendor_id: currentVendor?.id,
        customer_id: auth.id,
        total_amount: totalAmount,
        delivery_address: null, // Pickup order
        delivery_fee: 0,
        payment_method: 'cash', // Default to cash for now
        special_instructions: `Pickup time: ${selectedPickupTime}`,
        items: items.map(item => ({
          menu_item_id: item.id,
          quantity: item.quantity,
          unit_price: item.price,
          special_instructions: null,
        })),
      };

  // Create order in database
  const { data, error } = await customerService.createOrder(orderData);

      if (error) {
        throw error;
      }

      // Clear cart on success
      clearCart();

      // Persist the created order locally so the Orders screen can show it immediately
      try {
        if (data) {
          await AsyncStorage.setItem('@campusbite_recent_order', JSON.stringify(data));
        }
      } catch (e) {
        console.warn('[Cart] failed to cache recent order locally', e);
      }

      // Show success message
      Alert.alert(
        'Order Placed! 🎉',
        `Your order #${data.order_number} has been placed successfully. The vendor will prepare it for pickup at ${selectedPickupTime}.`,
        [
          {
            text: 'View Order',
            onPress: () => router.push('/(tabs)/orders'),
          },
        ]
      );

      // Navigate to orders page
      router.push('/(tabs)/orders');
    } catch (error) {
      console.error('Checkout error:', error);
      Alert.alert(
        'Checkout Failed',
        error.message || 'Failed to place order. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsCheckingOut(false);
    }
  };

  const renderCartItem = (item) => (
    <View
      key={`${item.id}-${item.vendorId}`}
      style={{
        backgroundColor: colors.surface,
        borderRadius: 16,
        marginBottom: 16,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
      }}
    >
      <View style={{ flexDirection: 'row' }}>
        {/* Item Image */}
        <Image
          source={{ uri: item.image }}
          style={{
            width: 80,
            height: 80,
            borderRadius: 12,
          }}
          contentFit="cover"
          transition={200}
        />

        {/* Item Details */}
        <View style={{ flex: 1, marginLeft: 16 }}>
          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: 8,
          }}>
            <Text style={{
              fontFamily: 'Inter_600SemiBold',
              fontSize: 16,
              color: colors.text,
              flex: 1,
              marginRight: 8,
            }}>
              {item.name}
            </Text>
            <TouchableOpacity
              onPress={() => handleRemoveItem(item.id, item.vendorId)}
              style={{
                padding: 4,
              }}
            >
              <Trash2 size={18} color={colors.error} />
            </TouchableOpacity>
          </View>

          <Text style={{
            fontFamily: 'Inter_400Regular',
            fontSize: 14,
            color: colors.textSecondary,
            marginBottom: 12,
          }}>
            {formatPrice(item.price)} each
          </Text>

          {/* Quantity Controls and Price */}
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: colors.primaryMuted,
              borderRadius: 20,
              paddingHorizontal: 4,
            }}>
              <TouchableOpacity
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: colors.primary,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
                onPress={() => handleQuantityChange(item.id, item.vendorId, -1)}
              >
                <Minus size={16} color="white" />
              </TouchableOpacity>
              
              <Text style={{
                fontFamily: 'Inter_600SemiBold',
                fontSize: 16,
                color: colors.text,
                minWidth: 32,
                textAlign: 'center',
                marginHorizontal: 8,
              }}>
                {item.quantity}
              </Text>
              
              <TouchableOpacity
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: colors.primary,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
                onPress={() => handleQuantityChange(item.id, item.vendorId, 1)}
              >
                <Plus size={16} color="white" />
              </TouchableOpacity>
            </View>

            <Text style={{
              fontFamily: 'Inter_600SemiBold',
              fontSize: 18,
              color: colors.primary,
            }}>
              {formatPrice(item.price * item.quantity)}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );

  const renderPickupTimeSlot = (timeSlot) => (
    <TouchableOpacity
      key={timeSlot.id}
      style={{
        backgroundColor: selectedPickupTime === timeSlot.time ? colors.primary : colors.surface,
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        marginRight: 12,
        borderWidth: 1,
        borderColor: selectedPickupTime === timeSlot.time ? colors.primary : colors.border,
      }}
      onPress={() => setSelectedPickupTime(timeSlot.time)}
    >
      <Text style={{
        fontFamily: 'Inter_500Medium',
        fontSize: 14,
        color: selectedPickupTime === timeSlot.time ? 'white' : colors.text,
      }}>
        {timeSlot.time}
      </Text>
    </TouchableOpacity>
  );

  if (items.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <StatusBar style={statusBarStyle} />
        
        {/* Fixed Header */}
        <View
          style={{
            paddingTop: insets.top,
            backgroundColor: colors.background,
            borderBottomWidth: 1,
            borderBottomColor: colors.separator,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'center',
              alignItems: 'center',
              paddingHorizontal: 24,
              paddingVertical: 16,
              height: headerHeight,
            }}
          >
            <Text style={{
              fontFamily: 'Inter_600SemiBold',
              fontSize: 24,
              color: colors.text,
            }}>
              Cart
            </Text>
          </View>
        </View>

        {/* Empty State */}
        <View style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: 48,
        }}>
          <View style={{
            width: 120,
            height: 120,
            backgroundColor: colors.primaryMuted,
            borderRadius: 60,
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: 24,
          }}>
            <ShoppingBag size={48} color={colors.primary} />
          </View>
          
          <Text style={{
            fontFamily: 'Inter_600SemiBold',
            fontSize: 24,
            color: colors.text,
            marginBottom: 12,
            textAlign: 'center',
          }}>
            Your cart is empty
          </Text>
          
          <Text style={{
            fontFamily: 'Inter_400Regular',
            fontSize: 16,
            color: colors.textSecondary,
            textAlign: 'center',
            lineHeight: 22,
            marginBottom: 32,
          }}>
            Add some delicious items from your favorite campus vendors to get started
          </Text>

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
        </View>
      </View>
    );
  }

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
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingHorizontal: 24,
            paddingVertical: 16,
            height: headerHeight,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text style={{
              fontFamily: 'Inter_600SemiBold',
              fontSize: 24,
              color: colors.text,
            }}>
              Cart
            </Text>
            <Text style={{
              fontFamily: 'Inter_400Regular',
              fontSize: 14,
              color: colors.textSecondary,
              marginTop: 2,
            }}>
              {getTotalItems()} items from {currentVendor?.name || 'vendor'}
            </Text>
          </View>
          
          <TouchableOpacity
            onPress={handleClearCart}
            style={{
              padding: 8,
            }}
          >
            <Text style={{
              fontFamily: 'Inter_500Medium',
              fontSize: 14,
              color: colors.error,
            }}>
              Clear
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: insets.top + headerHeight + 20,
          paddingHorizontal: 24,
          paddingBottom: 120, // Space for sticky checkout bar
        }}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
      >
        {/* Cart Items */}
        <View style={{ marginBottom: 32 }}>
          <Text style={{
            fontFamily: 'Inter_600SemiBold',
            fontSize: 18,
            color: colors.text,
            marginBottom: 16,
          }}>
            Your Order
          </Text>
          {items.map(renderCartItem)}
        </View>

        {/* Pickup Time Selection */}
        <View style={{ marginBottom: 32 }}>
          <Text style={{
            fontFamily: 'Inter_600SemiBold',
            fontSize: 18,
            color: colors.text,
            marginBottom: 16,
          }}>
            Pickup Time
          </Text>
          
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 16,
          }}>
            <Clock size={16} color={colors.textSecondary} />
            <Text style={{
              fontFamily: 'Inter_400Regular',
              fontSize: 14,
              color: colors.textSecondary,
              marginLeft: 8,
            }}>
              Select when you want to pick up your order
            </Text>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingRight: 24 }}
          >
            {pickupTimes.map(renderPickupTimeSlot)}
          </ScrollView>
        </View>

        {/* Order Summary */}
        <View style={{
          backgroundColor: colors.surface,
          borderRadius: 16,
          padding: 20,
          marginBottom: 32,
        }}>
          <Text style={{
            fontFamily: 'Inter_600SemiBold',
            fontSize: 18,
            color: colors.text,
            marginBottom: 16,
          }}>
            Order Summary
          </Text>

          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginBottom: 8,
          }}>
            <Text style={{
              fontFamily: 'Inter_400Regular',
              fontSize: 16,
              color: colors.text,
            }}>
              Subtotal ({getTotalItems()} items)
            </Text>
            <Text style={{
              fontFamily: 'Inter_500Medium',
              fontSize: 16,
              color: colors.text,
            }}>
              {formatPrice(getTotalPrice())}
            </Text>
          </View>

          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginBottom: 16,
            paddingBottom: 16,
            borderBottomWidth: 1,
            borderBottomColor: colors.separator,
          }}>
            <Text style={{
              fontFamily: 'Inter_400Regular',
              fontSize: 16,
              color: colors.text,
            }}>
              Service Fee
            </Text>
            <Text style={{
              fontFamily: 'Inter_500Medium',
              fontSize: 16,
              color: colors.text,
            }}>
              {formatPrice(2.00)}
            </Text>
          </View>

          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
          }}>
            <Text style={{
              fontFamily: 'Inter_600SemiBold',
              fontSize: 18,
              color: colors.text,
            }}>
              Total
            </Text>
            <Text style={{
              fontFamily: 'Inter_600SemiBold',
              fontSize: 18,
              color: colors.primary,
            }}>
              {formatPrice(getTotalPrice() + 2.00)}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Sticky Checkout Button */}
      <View style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: colors.background,
        paddingHorizontal: 24,
        paddingTop: 16,
        paddingBottom: insets.bottom + 16,
        borderTopWidth: 1,
        borderTopColor: colors.separator,
      }}>
        <TouchableOpacity
          style={{
            backgroundColor: colors.primary,
            borderRadius: 12,
            paddingVertical: 16,
            alignItems: 'center',
            opacity: !selectedPickupTime || isCheckingOut ? 0.6 : 1,
            flexDirection: 'row',
            justifyContent: 'center',
          }}
          onPress={handleContinueToCheckout}
          disabled={!selectedPickupTime || isCheckingOut}
        >
          {isCheckingOut ? (
            <>
              <ActivityIndicator color="white" style={{ marginRight: 8 }} />
              <Text style={{
                fontFamily: 'Inter_600SemiBold',
                fontSize: 16,
                color: 'white',
              }}>
                Placing Order...
              </Text>
            </>
          ) : (
            <Text style={{
              fontFamily: 'Inter_600SemiBold',
              fontSize: 16,
              color: 'white',
            }}>
              Place Order • {formatPrice(getTotalPrice() + 2.00)}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}