import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Animated,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Image } from 'expo-image';
import { Search, Star, Clock, MapPin, Filter, SlidersHorizontal } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { getVendors } from '@/lib/customerService';

const { width: screenWidth } = Dimensions.get('window');

export default function VendorsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors, statusBarStyle } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('rating'); // rating, distance, time, price
  const scrollY = useRef(new Animated.Value(0)).current;

  // State for vendors data
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const headerHeight = 180;

  const loadVendors = async () => {
    try {
      setError(null);
      const { data, error } = await getVendors();
      if (error) throw error;
      setVendors(data || []);
    } catch (err) {
      console.error('Failed to load vendors:', err);
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVendors();
  }, []);

  // Categories
  const categories = [
    { id: 'all', name: 'All', icon: '🍽️' },
    { id: 'fast-food', name: 'Fast Food', icon: '🍔' },
    { id: 'african', name: 'African', icon: '🍛' },
    { id: 'snacks', name: 'Snacks', icon: '🥨' },
    { id: 'drinks', name: 'Drinks', icon: '🥤' },
    { id: 'desserts', name: 'Desserts', icon: '🍰' },
    { id: 'healthy', name: 'Healthy', icon: '🥗' },
  ];

  // Demo vendors data (for development/testing)
  const demoVendors = [
    {
      id: '1',
      name: 'Mama Akos Kitchen',
      description: 'Authentic Ghanaian dishes made with love',
      category: 'african',
      image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop',
      rating: 4.8,
      reviewCount: 127,
      prepTime: '15-25 min',
      location: 'Main Campus',
      distance: '0.2 km',
      isOpen: true,
      featured: true,
      priceRange: '₵₵',
      tags: ['Popular', 'Spicy'],
      discount: null,
    },
    {
      id: '2',
      name: 'Quick Bite Express',
      description: 'Fast and delicious burgers, wraps & more',
      category: 'fast-food',
      image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=400&h=300&fit=crop',
      rating: 4.6,
      reviewCount: 89,
      prepTime: '10-15 min',
      location: 'Engineering Block',
      distance: '0.5 km',
      isOpen: true,
      featured: false,
      priceRange: '₵',
      tags: ['Fast'],
      discount: '10% off',
    },
    {
      id: '3',
      name: 'Fresh Fruit Paradise',
      description: 'Fresh juices, smoothies and healthy snacks',
      category: 'drinks',
      image: 'https://images.unsplash.com/photo-1546173159-315724a31696?w=400&h=300&fit=crop',
      rating: 4.9,
      reviewCount: 203,
      prepTime: '5-10 min',
      location: 'Library Entrance',
      distance: '0.1 km',
      isOpen: true,
      featured: true,
      priceRange: '₵',
      tags: ['Healthy', 'Fresh'],
      discount: null,
    },
    {
      id: '4',
      name: 'Sweet Treats Bakery',
      description: 'Freshly baked pastries, cakes and desserts',
      category: 'desserts',
      image: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&h=300&fit=crop',
      rating: 4.7,
      reviewCount: 156,
      prepTime: '5-15 min',
      location: 'Student Center',
      distance: '0.3 km',
      isOpen: false,
      featured: false,
      priceRange: '₵₵',
      tags: ['Sweet', 'Fresh'],
      discount: null,
    },
    {
      id: '5',
      name: 'Campus Café',
      description: 'Coffee, tea, light meals and study snacks',
      category: 'snacks',
      image: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=400&h=300&fit=crop',
      rating: 4.5,
      reviewCount: 67,
      prepTime: '5-12 min',
      location: 'Admin Building',
      distance: '0.4 km',
      isOpen: true,
      featured: false,
      priceRange: '₵',
      tags: ['Coffee', 'Study'],
      discount: 'Buy 2 Get 1',
    },
    {
      id: '6',
      name: 'Spicy Corner',
      description: 'Hot and spicy local delicacies',
      category: 'african',
      image: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=400&h=300&fit=crop',
      rating: 4.4,
      reviewCount: 94,
      prepTime: '20-30 min',
      location: 'Hostel Area',
      distance: '0.7 km',
      isOpen: true,
      featured: false,
      priceRange: '₵₵',
      tags: ['Spicy', 'Local'],
      discount: null,
    },
    {
      id: '7',
      name: 'Green Garden',
      description: 'Healthy salads, wraps and organic smoothies',
      category: 'healthy',
      image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop',
      rating: 4.6,
      reviewCount: 78,
      prepTime: '8-15 min',
      location: 'Sports Complex',
      distance: '0.6 km',
      isOpen: true,
      featured: false,
      priceRange: '₵₵',
      tags: ['Healthy', 'Organic'],
      discount: null,
    },
    {
      id: '8',
      name: 'Pizza Corner',
      description: 'Wood-fired pizzas and Italian classics',
      category: 'fast-food',
      image: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=400&h=300&fit=crop',
      rating: 4.3,
      reviewCount: 112,
      prepTime: '18-25 min',
      location: 'Food Court',
      distance: '0.3 km',
      isOpen: true,
      featured: false,
      priceRange: '₵₵₵',
      tags: ['Pizza', 'Italian'],
      discount: '15% off orders ₵50+',
    },
  ];

  const sortVendors = (vendors, sortBy) => {
    switch (sortBy) {
      case 'rating':
        return [...vendors].sort((a, b) => b.rating - a.rating);
      case 'distance':
        return [...vendors].sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance));
      case 'time':
        return [...vendors].sort((a, b) => {
          const aTime = parseInt(a.prepTime.split('-')[0]);
          const bTime = parseInt(b.prepTime.split('-')[0]);
          return aTime - bTime;
        });
      case 'price':
        return [...vendors].sort((a, b) => a.priceRange.length - b.priceRange.length);
      default:
        return vendors;
    }
  };

  const filteredVendors = sortVendors(
    vendors.filter((vendor) => {
      const matchesCategory = selectedCategory === 'all' || vendor.category === selectedCategory;
      const vendorName = vendor.business_name || vendor.name || '';
      const vendorDesc = vendor.business_description || vendor.description || '';
      const vendorTags = vendor.tags || [];
      const matchesSearch = vendorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           vendorDesc.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           vendorTags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesCategory && matchesSearch;
    }),
    sortBy
  );

  const handleVendorPress = async (vendor) => {
    await Haptics.selectionAsync();
    if (!vendor.is_active && !vendor.isOpen) {
      const vendorName = vendor.business_name || vendor.name || 'This vendor';
      Alert.alert('Vendor Closed', `${vendorName} is currently closed. Please check back during operating hours.`);
      return;
    }
    const vendorName = vendor.business_name || vendor.name || 'Vendor';
    router.push(`/vendor-menu?vendorId=${vendor.id}&vendorName=${encodeURIComponent(vendorName)}`);
  };

  const handleCategoryPress = async (category) => {
    await Haptics.selectionAsync();
    setSelectedCategory(category.id);
  };

  const handleSortPress = async () => {
    await Haptics.selectionAsync();

    const sortOptions = [
      { id: 'rating', name: 'Rating (High to Low)' },
      { id: 'distance', name: 'Distance (Near to Far)' },
      { id: 'time', name: 'Prep Time (Short to Long)' },
      { id: 'price', name: 'Price (Low to High)' },
    ];

    Alert.alert(
      'Sort Vendors',
      'Choose how to sort vendors:',
      sortOptions.map(option => ({
        text: option.name,
        onPress: () => setSortBy(option.id),
      }))
    );
  };

  const renderVendorCard = (vendor) => (
    <TouchableOpacity
      key={vendor.id}
      style={{
        backgroundColor: colors.surface,
        borderRadius: 16,
        marginBottom: 16,
        overflow: 'hidden',
        opacity: vendor.is_active ? 1 : 0.7,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
      }}
      onPress={() => handleVendorPress(vendor)}
    >
      {/* Vendor Image */}
      <View style={{ position: 'relative' }}>
        <Image
          source={{ uri: vendor.logo_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400' }}
          style={{
            width: '100%',
            height: 160,
          }}
          contentFit="cover"
          transition={200}
        />
        
        {/* Status Badge */}
        <View style={{
          position: 'absolute',
          top: 12,
          left: 12,
          backgroundColor: vendor.is_active ? colors.secondary : colors.textMuted,
          borderRadius: 6,
          paddingHorizontal: 8,
          paddingVertical: 4,
        }}>
          <Text style={{
            fontFamily: 'Inter_500Medium',
            fontSize: 12,
            color: 'white',
          }}>
            {vendor.is_active ? 'Open' : 'Closed'}
          </Text>
        </View>

        {/* Featured Badge */}
        {vendor.is_featured && (
          <View style={{
            position: 'absolute',
            bottom: 12,
            left: 12,
            backgroundColor: colors.primary,
            borderRadius: 6,
            paddingHorizontal: 8,
            paddingVertical: 4,
          }}>
            <Text style={{
              fontFamily: 'Inter_500Medium',
              fontSize: 12,
              color: 'white',
            }}>
              Featured
            </Text>
          </View>
        )}
      </View>

      {/* Vendor Info */}
      <View style={{ padding: 16 }}>
        <View style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 8,
        }}>
          <Text style={{
            fontFamily: 'Inter_600SemiBold',
            fontSize: 18,
            color: colors.text,
            flex: 1,
            marginRight: 8,
          }}>
            {vendor.business_name}
          </Text>
        </View>

        <Text style={{
          fontFamily: 'Inter_400Regular',
          fontSize: 14,
          color: colors.textSecondary,
          marginBottom: 12,
          lineHeight: 20,
        }}>
          {vendor.business_description || vendor.description || 'No description'}
        </Text>

        {/* Stats Row */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Star size={14} color={colors.primary} fill={colors.primary} />
              <Text style={{
                fontFamily: 'Inter_500Medium',
                fontSize: 14,
                color: colors.text,
              }}>
                {vendor.rating ? vendor.rating.toFixed(1) : 'New'}
              </Text>
            </View>
          </View>
          
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <MapPin size={14} color={colors.textSecondary} />
            <Text style={{
              fontFamily: 'Inter_400Regular',
              fontSize: 14,
              color: colors.textSecondary,
            }}>
              {vendor.address || vendor.location || 'Location not set'}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
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
          {/* Title */}
          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
          }}>
            <Text style={{
              fontFamily: 'Inter_600SemiBold',
              fontSize: 28,
              color: colors.text,
            }}>
              Vendors
            </Text>
            
            <TouchableOpacity
              style={{
                backgroundColor: colors.surface,
                borderRadius: 12,
                padding: 12,
                borderWidth: 1,
                borderColor: colors.border,
              }}
              onPress={handleSortPress}
            >
              <SlidersHorizontal size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.surface,
            borderRadius: 12,
            paddingHorizontal: 16,
            paddingVertical: 12,
            marginBottom: 16,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.05,
            shadowRadius: 2,
            elevation: 1,
          }}>
            <Search size={20} color={colors.textSecondary} />
            <TextInput
              style={{
                flex: 1,
                marginLeft: 12,
                fontFamily: 'Inter_400Regular',
                fontSize: 16,
                color: colors.text,
              }}
              placeholder="Search vendors, dishes, or tags..."
              placeholderTextColor={colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          {/* Categories */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 12 }}
          >
            {categories.map((category) => (
              <TouchableOpacity
                key={category.id}
                style={{
                  backgroundColor: selectedCategory === category.id ? colors.primary : colors.surface,
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: 20,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                }}
                onPress={() => handleCategoryPress(category)}
              >
                <Text style={{ fontSize: 16 }}>{category.icon}</Text>
                <Text style={{
                  fontFamily: 'Inter_500Medium',
                  fontSize: 14,
                  color: selectedCategory === category.id ? 'white' : colors.text,
                }}>
                  {category.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Animated.View>

      {/* Content */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: insets.top + headerHeight + 20,
          paddingHorizontal: 24,
          paddingBottom: 100,
        }}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await loadVendors();
              setRefreshing(false);
            }}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
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
              Loading vendors...
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
              Failed to load vendors
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
              onPress={loadVendors}
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

        {/* Results Header */}
        {!loading && !error && (
        <View style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}>
          <Text style={{
            fontFamily: 'Inter_500Medium',
            fontSize: 16,
            color: colors.text,
          }}>
            {filteredVendors.length} vendor{filteredVendors.length !== 1 ? 's' : ''} found
          </Text>
          
          <Text style={{
            fontFamily: 'Inter_400Regular',
            fontSize: 14,
            color: colors.textSecondary,
          }}>
            Sorted by {sortBy}
          </Text>
        </View>
        )}

        {/* Vendors List */}
        {!loading && !error && (
        filteredVendors.length > 0 ? (
          filteredVendors.map(renderVendorCard)
        ) : (
          <View style={{ alignments: 'center', paddingTop: 60 }}>
            <Text style={{ fontSize: 48, marginBottom: 16 }}>🔍</Text>
            <Text style={{
              fontFamily: 'Inter_500Medium',
              fontSize: 18,
              color: colors.text,
              marginBottom: 8,
            }}>
              No vendors found
            </Text>
            <Text style={{
              fontFamily: 'Inter_400Regular',
              fontSize: 14,
              color: colors.textSecondary,
              textAlign: 'center',
            }}>
              Try adjusting your search or category filter
            </Text>
          </View>
        )
        )}
      </ScrollView>
    </View>
  );
}
