import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Animated,
  Alert,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Image } from 'expo-image';
import { ArrowLeft, Star, MapPin, Plus, Minus } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useCart } from '@/contexts/CartContext';
import { getVendorById, getVendorMenu } from '@/lib/customerService';

const { width: screenWidth } = Dimensions.get('window');

export default function VendorMenuScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { vendorId, vendorName } = useLocalSearchParams();
  const { colors, statusBarStyle } = useTheme();
  const { addItem, formatPrice } = useCart();
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [quantities, setQuantities] = useState({});
  const scrollY = useRef(new Animated.Value(0)).current;

  const [vendor, setVendor] = useState(null);
  const [menuItems, setMenuItems] = useState([]);
  const [categories, setCategories] = useState([{ id: 'all', name: 'All' }]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const headerHeight = 88;

  const loadVendorData = async () => {
    try {
      setError(null);
      
      // Get vendor details
      const { data: vendorData, error: vendorError } = await getVendorById(vendorId);
      if (vendorError) throw vendorError;
      if (vendorData) {
        setVendor(vendorData);
      }
      
      // Get menu items
      const { data: menuData, error: menuError } = await getVendorMenu(vendorId);
      if (menuError) throw menuError;
      
      setMenuItems(menuData || []);
      
      // Extract unique categories from menu items
      if (menuData && menuData.length > 0) {
        const uniqueCategories = [...new Set(menuData
          .filter(item => item.menu_categories)
          .map(item => item.menu_categories.name))];
        
        if (uniqueCategories.length > 0) {
          setCategories([
            { id: 'all', name: 'All' },
            ...uniqueCategories.map(cat => ({ id: cat, name: cat }))
          ]);
        }
      }
    } catch (err) {
      console.error('Error loading vendor data:', err);
      setError(err.message || 'Failed to load menu');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVendorData();
  }, [vendorId]);

  const filteredItems = menuItems.filter(item => 
    selectedCategory === 'all' || item.menu_categories?.name === selectedCategory
  );

  const handleGoBack = async () => {
    await Haptics.selectionAsync();
    router.back();
  };

  const handleCategoryPress = async (category) => {
    await Haptics.selectionAsync();
    setSelectedCategory(category.id);
  };

  const updateQuantity = (itemId, change) => {
    setQuantities(prev => ({
      ...prev,
      [itemId]: Math.max(0, (prev[itemId] || 0) + change)
    }));
  };

  const handleAddToCart = async (item) => {
    if (!vendor) return;
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const quantity = quantities[item.id] || 1;
    const cartItem = {
      id: item.id,
      name: item.name,
      price: item.price,
      image: item.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=300',
      vendorId: vendor.id,
      vendorName: vendor.business_name,
      quantity: quantity,
    };
    addItem(cartItem);
    setQuantities(prev => ({
      ...prev,
      [item.id]: 0
    }));
    Alert.alert(
      'Added to Cart',
      `${quantity}x ${item.name} added to your cart`,
      [{ text: 'OK', style: 'default' }]
    );
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadVendorData();
    setRefreshing(false);
  };

  const renderCategoryTab = (category) => {
    const isSelected = selectedCategory === category.id;
    return (
      <TouchableOpacity
        key={category.id}
        style={{
          backgroundColor: isSelected ? colors.primary : colors.surface,
          borderRadius: 20,
          paddingHorizontal: 20,
          paddingVertical: 10,
          marginRight: 8,
        }}
        onPress={() => handleCategoryPress(category)}
      >
        <Text style={{
          fontFamily: 'Inter_500Medium',
          fontSize: 14,
          color: isSelected ? 'white' : colors.text,
        }}>
          {category.name}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderMenuItem = (item) => {
    const itemQuantity = quantities[item.id] || 0;
    
    return (
      <View
        key={item.id}
        style={{
          backgroundColor: colors.surface,
          borderRadius: 16,
          marginBottom: 16,
          overflow: 'hidden',
          flexDirection: 'row',
        }}
      >
        <Image
          source={{ uri: item.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=300' }}
          style={{ width: 120, height: 120 }}
          contentFit="cover"
          transition={200}
        />

        <View style={{ flex: 1, padding: 12 }}>
          <Text style={{
            fontFamily: 'Inter_600SemiBold',
            fontSize: 16,
            color: colors.text,
            marginBottom: 4,
          }}>
            {item.name}
          </Text>

          <Text style={{
            fontFamily: 'Inter_400Regular',
            fontSize: 13,
            color: colors.textSecondary,
            marginBottom: 8,
            lineHeight: 18,
          }} numberOfLines={2}>
            {item.description || 'No description available'}
          </Text>

          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <Text style={{
              fontFamily: 'Inter_600SemiBold',
              fontSize: 18,
              color: colors.primary,
            }}>
              {formatPrice(item.price)}
            </Text>

            {itemQuantity > 0 ? (
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: colors.primaryMuted,
                borderRadius: 20,
                paddingHorizontal: 4,
              }}>
                <TouchableOpacity
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    backgroundColor: colors.primary,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    updateQuantity(item.id, -1);
                  }}
                >
                  <Minus size={16} color="white" />
                </TouchableOpacity>

                <Text style={{
                  fontFamily: 'Inter_600SemiBold',
                  fontSize: 16,
                  color: colors.primary,
                  marginHorizontal: 12,
                  minWidth: 20,
                  textAlign: 'center',
                }}>
                  {itemQuantity}
                </Text>

                <TouchableOpacity
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    backgroundColor: colors.primary,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    updateQuantity(item.id, 1);
                  }}
                >
                  <Plus size={16} color="white" />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={{
                  backgroundColor: colors.primary,
                  borderRadius: 20,
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  flexDirection: 'row',
                  alignItems: 'center',
                }}
                onPress={() => handleAddToCart(item)}
              >
                <Plus size={16} color="white" />
                <Text style={{
                  fontFamily: 'Inter_500Medium',
                  fontSize: 14,
                  color: 'white',
                  marginLeft: 4,
                }}>
                  Add
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <StatusBar style={statusBarStyle} />
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{
          fontFamily: 'Inter_400Regular',
          fontSize: 14,
          color: colors.textSecondary,
          marginTop: 12,
        }}>
          Loading menu...
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <StatusBar style={statusBarStyle} />
        
        {/* Header */}
        <View style={{
          paddingTop: insets.top + 16,
          paddingHorizontal: 24,
          paddingBottom: 16,
          flexDirection: 'row',
          alignItems: 'center',
        }}>
          <TouchableOpacity
            onPress={handleGoBack}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: colors.surface,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ArrowLeft size={20} color={colors.text} />
          </TouchableOpacity>
          <Text style={{
            fontFamily: 'Inter_600SemiBold',
            fontSize: 18,
            color: colors.text,
            marginLeft: 16,
          }}>
            {vendorName || 'Menu'}
          </Text>
        </View>

        {/* Error State */}
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <Text style={{ fontSize: 48, marginBottom: 16 }}>😕</Text>
          <Text style={{
            fontFamily: 'Inter_600SemiBold',
            fontSize: 18,
            color: colors.text,
            marginBottom: 8,
          }}>
            Failed to load menu
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
            onPress={loadVendorData}
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
          paddingTop: insets.top + 16,
          paddingHorizontal: 24,
          paddingBottom: 16,
          borderBottomWidth: scrollY.interpolate({
            inputRange: [0, 1],
            outputRange: [0, 1],
            extrapolate: 'clamp',
          }),
          borderBottomColor: colors.separator,
        }}
      >
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <TouchableOpacity
              onPress={handleGoBack}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: colors.surface,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 12,
              }}
            >
              <ArrowLeft size={20} color={colors.text} />
            </TouchableOpacity>
            
            <View style={{ flex: 1 }}>
              <Text style={{
                fontFamily: 'Inter_600SemiBold',
                fontSize: 18,
                color: colors.text,
              }} numberOfLines={1}>
                {vendor?.business_name || vendorName || 'Menu'}
              </Text>
              {vendor?.rating && (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                  <Star size={12} color={colors.primary} fill={colors.primary} />
                  <Text style={{
                    fontFamily: 'Inter_400Regular',
                    fontSize: 12,
                    color: colors.textSecondary,
                    marginLeft: 4,
                  }}>
                    {vendor.rating.toFixed(1)}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </Animated.View>

      {/* Content */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: insets.top + headerHeight + 20,
          paddingBottom: insets.bottom + 20,
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
        {/* Categories */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 24,
            paddingBottom: 16,
          }}
        >
          {categories.map(renderCategoryTab)}
        </ScrollView>

        {/* Menu Items */}
        <View style={{ paddingHorizontal: 24 }}>
          {filteredItems.length > 0 ? (
            filteredItems.map(renderMenuItem)
          ) : (
            <View style={{
              backgroundColor: colors.surface,
              borderRadius: 16,
              padding: 40,
              alignItems: 'center',
              marginTop: 40,
            }}>
              <Text style={{
                fontFamily: 'Inter_500Medium',
                fontSize: 18,
                color: colors.textSecondary,
                textAlign: 'center',
              }}>
                No items available
              </Text>
              <Text style={{
                fontFamily: 'Inter_400Regular',
                fontSize: 14,
                color: colors.textSecondary,
                marginTop: 8,
                textAlign: 'center',
              }}>
                This vendor hasn't added any menu items yet
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
