import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Animated,
  TextInput,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Image } from 'expo-image';
import { Search, Star, Clock, MapPin } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/utils/auth/useAuth';
import customerService from '@/lib/customerService';

const { width: screenWidth } = Dimensions.get('window');

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors, statusBarStyle } = useTheme();
  const { auth } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const scrollY = useRef(new Animated.Value(0)).current;
  
  // State for real data
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const headerHeight = 140;

  // Load vendors from database
  const loadVendors = async () => {
    try {
      setError(null);
      const result = await customerService.getVendors({
        searchQuery,
        category: selectedCategory === 'all' ? null : selectedCategory,
      });
      
      if (result.error) throw result.error;
      
      setVendors(result.data || []);
    } catch (error) {
      console.error('Error loading vendors:', error);
      setError(error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadVendors();
  }, [selectedCategory]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery || searchQuery === '') {
        loadVendors();
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadVendors();
  };

  // Categories remain static for UI
  const categories = [
        { id: 'all', name: 'All', icon: '🍽️' },
    { id: 'fast-food', name: 'Fast Food', icon: '🍔' },
    { id: 'african', name: 'African', icon: '🍛' },
    { id: 'snacks', name: 'Snacks', icon: '🥨' },
    { id: 'drinks', name: 'Drinks', icon: '🥤' },
    { id: 'desserts', name: 'Desserts', icon: '🍰' },
  ];

  
  const filteredVendors = vendors.filter((vendor) => {
    const matchesCategory = selectedCategory === 'all' || vendor.category === selectedCategory;
    const vendorName = vendor.business_name || vendor.name || '';
    const vendorDesc = vendor.business_description || vendor.description || '';
    const matchesSearch = vendorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         vendorDesc.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const featuredVendors = vendors.filter(vendor => vendor.is_featured || vendor.featured);

  const handleVendorPress = async (vendor) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/vendor-menu?vendorId=${vendor.id}&vendorName=${encodeURIComponent(vendor.business_name)}`);
  };  const handleCategoryPress = async (category) => {
    await Haptics.selectionAsync();
    setSelectedCategory(category.id);
  };

  const renderVendorCard = (vendor, featured = false) => (
    <TouchableOpacity
      key={vendor.id}
      style={{
        backgroundColor: colors.surface,
        borderRadius: 16,
        marginBottom: 16,
        marginHorizontal: featured ? 0 : 0,
        marginRight: featured ? 16 : 0,
        width: featured ? screenWidth * 0.8 : '100%',
        overflow: 'hidden',
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
          source={{ uri: vendor.logo_url || 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400' }}
          style={{
            width: '100%',
            height: featured ? 140 : 160,
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
            top: 12,
            right: 12,
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
          {/* Greeting */}
          <View style={{ marginBottom: 16 }}>
            <Text style={{
              fontFamily: 'Inter_400Regular',
              fontSize: 16,
              color: colors.textSecondary,
            }}>
              Hello {auth?.full_name?.split(' ')[0] || 'Student'} 👋
            </Text>
            <Text style={{
              fontFamily: 'Inter_600SemiBold',
              fontSize: 24,
              color: colors.text,
              marginTop: 4,
            }}>
              What are you craving today?
            </Text>
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
              placeholder="Search vendors or dishes..."
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
          <View style={{ alignItems: 'center', paddingTop: 40, paddingHorizontal: 24 }}>
            <Text style={{ fontSize: 48, marginBottom: 16 }}>😕</Text>
            <Text style={{
              fontFamily: 'Inter_500Medium',
              fontSize: 18,
              color: colors.text,
              marginBottom: 8,
            }}>
              Oops! Something went wrong
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

        {/* Featured Vendors */}
        {!loading && !error && featuredVendors.length > 0 && selectedCategory === 'all' && !searchQuery && (
          <View style={{ marginBottom: 24 }}>
            <Text style={{
              fontFamily: 'Inter_600SemiBold',
              fontSize: 20,
              color: colors.text,
              paddingHorizontal: 24,
              marginBottom: 16,
            }}>
              Featured Vendors
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{
                paddingLeft: 24,
                paddingRight: 8,
              }}
            >
              {featuredVendors.map(vendor => renderVendorCard(vendor, true))}
            </ScrollView>
          </View>
        )}

        {/* All Vendors */}
        {!loading && !error && (
          <View style={{ paddingHorizontal: 24 }}>
            <Text style={{
              fontFamily: 'Inter_600SemiBold',
              fontSize: 20,
              color: colors.text,
              marginBottom: 16,
            }}>
              {selectedCategory === 'all' ? 'All Vendors' : categories.find(c => c.id === selectedCategory)?.name + ' Vendors'}
            </Text>

            {filteredVendors.length > 0 ? (
              filteredVendors.map(vendor => renderVendorCard(vendor))
            ) : (
              <View style={{ alignItems: 'center', paddingTop: 40 }}>
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
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}