import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  TextInput,
  Alert,
  Modal,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { 
  ArrowLeft,
  Plus,
  Edit3,
  Trash2,
  Image as ImageIcon,
  Eye,
  EyeOff,
  Search,
  Filter,
  X,
  Camera,
  ChevronDown,
  Check,
  Settings2,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/utils/auth/useAuth';
import vendorService from '@/lib/vendorService';
import { useUpload } from '@/utils/useUpload';

export default function VendorMenuManagementScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors, statusBarStyle } = useTheme();
  const { auth } = useAuth();
  const [upload, { loading: uploading }] = useUpload();
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showManageCategoriesModal, setShowManageCategoriesModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  
  // State for real data
  const [vendorProfile, setVendorProfile] = useState(null);
  const [menuItems, setMenuItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Load vendor data and menu
  const loadMenuData = async () => {
    try {
  if (!auth?.id) return;
      
      setError(null);
      
      // Get vendor profile
  const profileResult = await vendorService.getVendorProfile(auth.id);
      if (profileResult.error) throw profileResult.error;
      if (!profileResult.data?.id) {
        throw new Error('Vendor profile not found. Please ensure you have completed your vendor registration.');
      }
      
      setVendorProfile(profileResult.data);
      
      if (profileResult.data?.id) {
        // Get menu categories
        const categoriesResult = await vendorService.getMenuCategories(profileResult.data.id);
        if (categoriesResult.error) throw categoriesResult.error;
        
        const dbCategories = categoriesResult.data || [];
        
        // Get menu items
        const menuResult = await vendorService.getVendorMenu(profileResult.data.id, {
          includeInactive: true
        });
        if (menuResult.error) throw menuResult.error;
        
        setMenuItems(menuResult.data || []);
        
        // Build categories with counts
        const allCount = menuResult.data?.length || 0;
        const categoryOptions = [
          { id: 'all', name: 'All Items', count: allCount },
          ...dbCategories.map(cat => ({
            id: cat.id,
            name: cat.name,
            count: menuResult.data?.filter(item => item.category_id === cat.id).length || 0
          }))
        ];
        
        setCategories(categoryOptions);
      }
    } catch (error) {
      console.error('Error loading menu data:', error);
      setError(error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadMenuData();
  }, [auth?.user?.id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadMenuData();
  };

  // Mock initial data structure (will be replaced by DB)
  const [newItem, setNewItem] = useState({
    name: '',
    description: '',
    price: '',
    category_id: null,
    preparation_time: '',
    ingredients: '',
    image_url: null,
    image_base64: null,
  });

  const filteredItems = menuItems.filter(item => {
    const matchesCategory = selectedCategory === 'all' || item.category_id === selectedCategory;
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         item.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handlePickImage = async () => {
    try {
      await Haptics.selectionAsync();
      
      // Request permission
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please allow access to your photo library to upload menu images.');
        return;
      }

      // Pick image
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: true, // request base64 to avoid file-system blob issues in native runtimes
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const base64Data = asset.base64 ? asset.base64.replace(/^data:image\/[a-z]+;base64,/, '') : null;
        setNewItem(prev => ({ ...prev, image_url: asset.uri, image_base64: base64Data }));
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const handleRemoveImage = async () => {
    await Haptics.selectionAsync();
    setNewItem(prev => ({ ...prev, image_url: null, image_base64: null }));
  };

  const handleToggleAvailability = async (itemId) => {
    if (!vendorProfile?.id) return;
    
    try {
      await Haptics.selectionAsync();
      
      // Find the item to toggle
      const item = menuItems.find(i => i.id === itemId);
      if (!item) return;
      
      // Update in database
      const result = await vendorService.saveMenuItem(
        vendorProfile.id,
        { is_available: !item.is_available },
        itemId
      );
      
      if (result.error) {
        Alert.alert('Error', 'Failed to update item availability');
        return;
      }
      
      // Update local state
      setMenuItems(prev => prev.map(i => 
        i.id === itemId ? { ...i, is_available: !i.is_available } : i
      ));
    } catch (error) {
      console.error('Error toggling availability:', error);
      Alert.alert('Error', 'Failed to update item');
    }
  };

  const handleDeleteItem = async (itemId, itemName) => {
    if (!vendorProfile?.id) return;
    
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      'Delete Menu Item',
      `Are you sure you want to delete "${itemName}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await vendorService.deleteMenuItem(vendorProfile.id, itemId);
              
              if (result.error) {
                Alert.alert('Error', 'Failed to delete item');
                return;
              }
              
              // Update local state
              setMenuItems(prev => prev.filter(item => item.id !== itemId));
              
              Alert.alert('Success', 'Menu item deleted successfully');
            } catch (error) {
              console.error('Error deleting item:', error);
              Alert.alert('Error', 'Failed to delete item');
            }
          }
        }
      ]
    );
  };

  const handleEditItem = async (item) => {
    await Haptics.selectionAsync();
    setEditingItem(item);
    setNewItem({
      name: item.name,
      description: item.description || '',
      price: item.price.toString(),
      category_id: item.category_id,
      preparation_time: item.preparation_time?.toString() || '',
      // menu_items.ingredients is stored as TEXT[] in the DB. Convert to a comma-separated
      // string for the editor so users can type a single-line list like "eggs, salt, oil".
      ingredients: Array.isArray(item.ingredients) ? item.ingredients.join(', ') : (item.ingredients || ''),
      image_url: item.image_url || null,
    });
    setShowAddModal(true);
  };

  const handleSaveItem = async () => {
    if (!vendorProfile?.id) {
      Alert.alert('Error', 'Vendor profile could not be loaded. Please try again.');
      return;
    }

    if (!newItem.name || !newItem.price || !newItem.description || !newItem.category_id) {
      Alert.alert('Error', 'Please fill in all required fields, including category.');
      return;
    }

    try {
      setSaving(true);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      let imageUrl = newItem.image_url;

      // Upload image: prefer base64 path (more reliable on native runtimes).
      if (newItem.image_base64) {
        const uploadResult = await upload({ base64: newItem.image_base64, name: `menu-item-${Date.now()}.jpg` });
        if (uploadResult?.error) {
          console.error('Upload error', uploadResult.error);
          Alert.alert('Error', 'Failed to upload image');
          return;
        }
        imageUrl = uploadResult.url || uploadResult.publicURL || uploadResult.path || uploadResult?.data?.publicURL || uploadResult?.data?.path || imageUrl;
      } else if (newItem.image_url && newItem.image_url.startsWith('file://')) {
        // Fallback: upload using reactNativeAsset (no base64 available)
        const uploadResult = await upload({
          reactNativeAsset: {
            uri: newItem.image_url,
            name: `menu-item-${Date.now()}.jpg`,
            mimeType: 'image/jpeg',
          }
        });

        if (uploadResult?.error) {
          console.error('Upload error', uploadResult.error);
          Alert.alert('Error', 'Failed to upload image');
          return;
        }

        imageUrl = uploadResult.url || uploadResult.publicURL || uploadResult.path || uploadResult?.data?.publicURL || uploadResult?.data?.path || imageUrl;
      }

      const itemData = {
        name: newItem.name,
        description: newItem.description,
        price: parseFloat(newItem.price),
        category_id: newItem.category_id,
        preparation_time: parseInt(newItem.preparation_time) || 15,
        // Convert ingredients text (comma separated from the form) into an array for the
        // TEXT[] column expected by Postgres/Supabase.
        ingredients: Array.isArray(newItem.ingredients)
          ? newItem.ingredients
          : (newItem.ingredients || '').split(',').map(s => s.trim()).filter(Boolean),
        image_url: imageUrl,
        is_available: true,
      };

      let result;
      if (editingItem) {
        // Update existing item
        console.log('Saving existing item', { vendorId: vendorProfile.id, itemId: editingItem.id, itemData });
        result = await vendorService.saveMenuItem(vendorProfile.id, itemData, editingItem.id);
      } else {
        // Add new item
        console.log('Creating new item', { vendorId: vendorProfile.id, itemData });
        result = await vendorService.saveMenuItem(vendorProfile.id, itemData);
      }

      if (result.error) {
        console.error('saveMenuItem error:', result.error);
        const msg = result.error?.message || String(result.error);
        Alert.alert('Error', `Failed to save menu item: ${msg}`);
        return;
      }

      // Reload menu data to get fresh data
      await loadMenuData();

      setShowAddModal(false);
      setEditingItem(null);
      setNewItem({
        name: '',
        description: '',
        price: '',
        category_id: null,
        preparation_time: '',
        ingredients: '',
        image_url: null,
        image_base64: null,
      });

      Alert.alert('Success', editingItem ? 'Item updated successfully' : 'Item added successfully');
    } catch (error) {
      console.error('Error saving item:', error);
      Alert.alert('Error', 'Failed to save item');
    } finally {
      setSaving(false);
    }
  };

  const renderCategoryTab = (category) => (
    <TouchableOpacity
      key={category.id}
      onPress={() => setSelectedCategory(category.id)}
      style={{
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: selectedCategory === category.id ? colors.primary : colors.surface,
        borderRadius: 20,
        marginRight: 12,
      }}
    >
      <Text style={{
        fontFamily: 'Inter_500Medium',
        fontSize: 14,
        color: selectedCategory === category.id ? '#fff' : colors.text,
      }}>
        {category.name} ({category.count})
      </Text>
    </TouchableOpacity>
  );

  const renderMenuItem = (item) => (
    <View key={item.id} style={{
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
      {/* Item Header */}
      <View style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
      }}>
        <View style={{ flex: 1, marginRight: 16 }}>
          <Text style={{
            fontFamily: 'Inter_600SemiBold',
            fontSize: 18,
            color: colors.text,
            marginBottom: 4,
          }}>
            {item.name}
          </Text>
          <Text style={{
            fontFamily: 'Inter_400Regular',
            fontSize: 14,
            color: colors.textSecondary,
            marginBottom: 8,
          }}>
            {item.description || 'No description'}
          </Text>
          <Text style={{
            fontFamily: 'Inter_600SemiBold',
            fontSize: 20,
            color: colors.primary,
          }}>
            ₵{parseFloat(item.price).toFixed(2)}
          </Text>
        </View>

        <View style={{
          width: 80,
          height: 80,
          borderRadius: 12,
          backgroundColor: colors.inputBackground,
          justifyContent: 'center',
          alignItems: 'center',
        }}>
          {item.image_url ? (
            <Image source={{ uri: item.image_url }} style={{ width: 80, height: 80, borderRadius: 12 }} />
          ) : (
            <ImageIcon size={32} color={colors.textSecondary} />
          )}
        </View>
      </View>

      {/* Item Details */}
      <View style={{
        flexDirection: 'row',
        marginBottom: 16,
      }}>
        <View style={{
          backgroundColor: colors.primary + '15',
          paddingHorizontal: 8,
          paddingVertical: 4,
          borderRadius: 8,
          marginRight: 8,
        }}>
          <Text style={{
            fontFamily: 'Inter_500Medium',
            fontSize: 12,
            color: colors.primary,
          }}>
            {item.preparation_time || 15} min
          </Text>
        </View>
        
        <View style={{
          backgroundColor: item.is_available ? '#34C759' : '#FF3B30',
          paddingHorizontal: 8,
          paddingVertical: 4,
          borderRadius: 8,
        }}>
          <Text style={{
            fontFamily: 'Inter_500Medium',
            fontSize: 12,
            color: '#fff',
          }}>
            {item.is_available ? 'Available' : 'Unavailable'}
          </Text>
        </View>
      </View>

      {/* Availability Toggle */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: colors.border,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {item.is_available ? (
            <Eye size={20} color={colors.primary} />
          ) : (
            <EyeOff size={20} color={colors.textSecondary} />
          )}
          <Text style={{
            fontFamily: 'Inter_500Medium',
            fontSize: 16,
            color: colors.text,
            marginLeft: 8,
          }}>
            {item.is_available ? 'Visible to customers' : 'Hidden from customers'}
          </Text>
        </View>
        
        <Switch
          value={item.is_available}
          onValueChange={() => handleToggleAvailability(item.id)}
          trackColor={{ false: colors.textMuted, true: colors.primary }}
          thumbColor={'white'}
        />
      </View>

      {/* Action Buttons */}
      <View style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
      }}>
        <TouchableOpacity
          onPress={() => handleEditItem(item)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.primary + '15',
            paddingHorizontal: 20,
            paddingVertical: 10,
            borderRadius: 8,
            flex: 1,
            marginRight: 8,
          }}
        >
          <Edit3 size={16} color={colors.primary} />
          <Text style={{
            fontFamily: 'Inter_500Medium',
            fontSize: 14,
            color: colors.primary,
            marginLeft: 6,
          }}>
            Edit
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => handleDeleteItem(item.id, item.name)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#FF3B30' + '15',
            paddingHorizontal: 20,
            paddingVertical: 10,
            borderRadius: 8,
            flex: 1,
            marginLeft: 8,
          }}
        >
          <Trash2 size={16} color="#FF3B30" />
          <Text style={{
            fontFamily: 'Inter_500Medium',
            fontSize: 14,
            color: '#FF3B30',
            marginLeft: 6,
          }}>
            Delete
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // Loading state
  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <StatusBar style={statusBarStyle} />
        
        <View style={{
          paddingTop: insets.top + 16,
          paddingHorizontal: 24,
          paddingBottom: 20,
        }}>
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
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
              Menu Management
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
            Loading your menu...
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
        
        <View style={{
          paddingTop: insets.top + 16,
          paddingHorizontal: 24,
          paddingBottom: 20,
        }}>
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
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
              Menu Management
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
            Error Loading Menu
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
            onPress={loadMenuData}
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
          borderTopColor: colors.border,
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
            Menu Management
          </Text>

          <TouchableOpacity
            onPress={() => setShowManageCategoriesModal(true)}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: colors.surface,
              justifyContent: 'center',
              alignItems: 'center',
              marginRight: 12,
            }}
          >
            <Settings2 size={20} color={colors.text} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setShowAddModal(true)}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: colors.primary,
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Plus size={20} color="#fff" />
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
        }}>
          <Search size={20} color={colors.textSecondary} />
          <TextInput
            placeholder="Search menu items..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={{
              flex: 1,
              marginLeft: 12,
              fontFamily: 'Inter_400Regular',
              fontSize: 16,
              color: colors.text,
            }}
          />
        </View>

        {/* Category Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingRight: 24 }}
        >
          {categories.map(renderCategoryTab)}
        </ScrollView>
      </View>

      {/* Menu Items */}
      <ScrollView
        style={{ flex: 1 }}
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
      >
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
            <ImageIcon size={48} color={colors.textSecondary} />
            <Text style={{
              fontFamily: 'Inter_500Medium',
              fontSize: 18,
              color: colors.textSecondary,
              marginTop: 16,
              textAlign: 'center',
            }}>
              No menu items found
            </Text>
            <Text style={{
              fontFamily: 'Inter_400Regular',
              fontSize: 14,
              color: colors.textSecondary,
              marginTop: 8,
              textAlign: 'center',
            }}>
              Try adjusting your search or filter
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Add/Edit Item Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <View
            style={{
              paddingTop: insets.top + 16,
              paddingHorizontal: 24,
              paddingBottom: 20,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}
          >
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <TouchableOpacity
                onPress={() => {
                  setShowAddModal(false);
                  setEditingItem(null);
                  setNewItem({
                    name: '',
                    description: '',
                    price: '',
                    category_id: null,
                    preparation_time: '',
                    ingredients: '',
                    image_url: null,
                  });
                }}
              >
                <Text style={{
                  fontFamily: 'Inter_500Medium',
                  fontSize: 16,
                  color: colors.primary,
                }}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <Text style={{
                fontFamily: 'Inter_600SemiBold',
                fontSize: 18,
                color: colors.text,
              }}>
                {editingItem ? 'Edit Item' : 'Add New Item'}
              </Text>

              <TouchableOpacity onPress={handleSaveItem} disabled={saving || uploading}>
                {saving || uploading ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Text style={{
                    fontFamily: 'Inter_600SemiBold',
                    fontSize: 16,
                    color: colors.primary,
                  }}>
                    Save
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{
              padding: 24,
              paddingBottom: insets.bottom + 32,
            }}
          >
            {/* Image Upload */}
            <View style={{ marginBottom: 24 }}>
              <Text style={{
                fontFamily: 'Inter_500Medium',
                fontSize: 16,
                color: colors.text,
                marginBottom: 12,
              }}>
                Item Image
              </Text>
              
              {newItem.image_url ? (
                <View style={{
                  position: 'relative',
                  width: '100%',
                  height: 200,
                  borderRadius: 16,
                  overflow: 'hidden',
                  backgroundColor: colors.surface,
                }}>
                  <Image
                    source={{ uri: newItem.image_url }}
                    style={{ width: '100%', height: '100%' }}
                    contentFit="cover"
                  />
                  <TouchableOpacity
                    onPress={handleRemoveImage}
                    style={{
                      position: 'absolute',
                      top: 12,
                      right: 12,
                      backgroundColor: 'rgba(0,0,0,0.6)',
                      borderRadius: 20,
                      width: 36,
                      height: 36,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <X size={20} color="white" />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  onPress={handlePickImage}
                  style={{
                    backgroundColor: colors.surface,
                    borderRadius: 16,
                    borderWidth: 2,
                    borderColor: colors.border,
                    borderStyle: 'dashed',
                    height: 200,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Camera size={40} color={colors.textSecondary} />
                  <Text style={{
                    fontFamily: 'Inter_500Medium',
                    fontSize: 16,
                    color: colors.textSecondary,
                    marginTop: 12,
                  }}>
                    Add Image
                  </Text>
                  <Text style={{
                    fontFamily: 'Inter_400Regular',
                    fontSize: 14,
                    color: colors.textSecondary,
                    marginTop: 4,
                  }}>
                    Tap to upload from gallery
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Form Fields */}
            <View style={{ marginBottom: 20 }}>
              <Text style={{
                fontFamily: 'Inter_500Medium',
                fontSize: 16,
                color: colors.text,
                marginBottom: 8,
              }}>
                Item Name *
              </Text>
              <TextInput
                value={newItem.name}
                onChangeText={(text) => setNewItem(prev => ({ ...prev, name: text }))}
                placeholder="Enter item name"
                placeholderTextColor={colors.textSecondary}
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: 12,
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  fontFamily: 'Inter_400Regular',
                  fontSize: 16,
                  color: colors.text,
                }}
              />
            </View>

            <View style={{ marginBottom: 20 }}>
              <Text style={{
                fontFamily: 'Inter_500Medium',
                fontSize: 16,
                color: colors.text,
                marginBottom: 8,
              }}>
                Description *
              </Text>
              <TextInput
                value={newItem.description}
                onChangeText={(text) => setNewItem(prev => ({ ...prev, description: text }))}
                placeholder="Describe your item"
                placeholderTextColor={colors.textSecondary}
                multiline
                numberOfLines={3}
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: 12,
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  fontFamily: 'Inter_400Regular',
                  fontSize: 16,
                  color: colors.text,
                  textAlignVertical: 'top',
                }}
              />
            </View>

            <View style={{ marginBottom: 20 }}>
              <Text style={{
                fontFamily: 'Inter_500Medium',
                fontSize: 16,
                color: colors.text,
                marginBottom: 8,
              }}>
                Category *
              </Text>
              <TouchableOpacity
                onPress={() => setShowCategoryModal(true)}
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: 12,
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Text style={{
                  fontFamily: 'Inter_400Regular',
                  fontSize: 16,
                  color: newItem.category_id ? colors.text : colors.textSecondary,
                }}>
                  {categories.find(c => c.id === newItem.category_id)?.name || 'Select a category'}
                </Text>
                <ChevronDown size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={{
              flexDirection: 'row',
              marginBottom: 20,
            }}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={{
                  fontFamily: 'Inter_500Medium',
                  fontSize: 16,
                  color: colors.text,
                  marginBottom: 8,
                }}>
                  Price (₵) *
                </Text>
                <TextInput
                  value={newItem.price}
                  onChangeText={(text) => setNewItem(prev => ({ ...prev, price: text }))}
                  placeholder="0.00"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="decimal-pad"
                  style={{
                    backgroundColor: colors.surface,
                    borderRadius: 12,
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    fontFamily: 'Inter_400Regular',
                    fontSize: 16,
                    color: colors.text,
                  }}
                />
              </View>

              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={{
                  fontFamily: 'Inter_500Medium',
                  fontSize: 16,
                  color: colors.text,
                  marginBottom: 8,
                }}>
                  Prep Time (min)
                </Text>
                <TextInput
                  value={newItem.preparationTime}
                  onChangeText={(text) => setNewItem(prev => ({ ...prev, preparationTime: text }))}
                  placeholder="15"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="number-pad"
                  style={{
                    backgroundColor: colors.surface,
                    borderRadius: 12,
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    fontFamily: 'Inter_400Regular',
                    fontSize: 16,
                    color: colors.text,
                  }}
                />
              </View>
            </View>

            <View style={{ marginBottom: 20 }}>
              <Text style={{
                fontFamily: 'Inter_500Medium',
                fontSize: 16,
                color: colors.text,
                marginBottom: 8,
              }}>
                Ingredients
              </Text>
              <TextInput
                value={newItem.ingredients}
                onChangeText={(text) => setNewItem(prev => ({ ...prev, ingredients: text }))}
                placeholder="Rice, Chicken, Tomatoes, etc. (separated by commas)"
                placeholderTextColor={colors.textSecondary}
                multiline
                numberOfLines={2}
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: 12,
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  fontFamily: 'Inter_400Regular',
                  fontSize: 16,
                  color: colors.text,
                  textAlignVertical: 'top',
                }}
              />
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Category Picker Modal */}
      <Modal
        visible={showCategoryModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <View
            style={{
              paddingTop: insets.top + 16,
              paddingHorizontal: 24,
              paddingBottom: 20,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Text style={{
              fontFamily: 'Inter_600SemiBold',
              fontSize: 18,
              color: colors.text,
            }}>
              Select Category
            </Text>
            <TouchableOpacity onPress={() => setShowCategoryModal(false)}>
              <Text style={{
                fontFamily: 'Inter_500Medium',
                fontSize: 16,
                color: colors.primary,
              }}>
                Done
              </Text>
            </TouchableOpacity>
          </View>
          <ScrollView>
            {categories.filter(c => c.id !== 'all').map(category => (
              <TouchableOpacity
                key={category.id}
                onPress={() => {
                  setNewItem(prev => ({ ...prev, category_id: category.id }));
                  setShowCategoryModal(false);
                }}
                style={{
                  paddingHorizontal: 24,
                  paddingVertical: 16,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Text style={{
                  fontFamily: 'Inter_500Medium',
                  fontSize: 16,
                  color: colors.text,
                }}>
                  {category.name}
                </Text>
                {newItem.category_id === category.id && (
                  <Check size={20} color={colors.primary} />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>

      {/* Manage Categories Modal */}
      <Modal
        visible={showManageCategoriesModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <View
            style={{
              paddingTop: insets.top + 16,
              paddingHorizontal: 24,
              paddingBottom: 20,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Text style={{
              fontFamily: 'Inter_600SemiBold',
              fontSize: 18,
              color: colors.text,
            }}>
              Manage Categories
            </Text>
            <TouchableOpacity onPress={() => setShowManageCategoriesModal(false)}>
              <Text style={{
                fontFamily: 'Inter_500Medium',
                fontSize: 16,
                color: colors.primary,
              }}>
                Done
              </Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 24 }}>
            <View style={{ marginBottom: 24 }}>
              <Text style={{
                fontFamily: 'Inter_500Medium',
                fontSize: 16,
                color: colors.text,
                marginBottom: 8,
              }}>
                Add New Category
              </Text>
              <View style={{ flexDirection: 'row' }}>
                <TextInput
                  value={newCategoryName}
                  onChangeText={setNewCategoryName}
                  placeholder="Enter category name"
                  placeholderTextColor={colors.textSecondary}
                  style={{
                    flex: 1,
                    backgroundColor: colors.surface,
                    borderRadius: 12,
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    fontFamily: 'Inter_400Regular',
                    fontSize: 16,
                    color: colors.text,
                    marginRight: 12,
                  }}
                />
                <TouchableOpacity
                  onPress={async () => {
                    if (!newCategoryName.trim()) return;
                    if (!vendorProfile?.id) {
                      Alert.alert('Error', 'Vendor profile not loaded. Please try again.');
                      return;
                    }
                    try {
                      console.log('Adding category', { vendorId: vendorProfile.id, name: newCategoryName.trim() });
                      const result = await vendorService.saveMenuCategory(vendorProfile.id, { name: newCategoryName.trim() });
                      if (!result.error) {
                        setNewCategoryName('');
                        await loadMenuData();
                        return;
                      }

                      console.error('Failed to save menu category:', result.error);
                      const msg = result.error?.message || String(result.error);
                      Alert.alert('Error', `Failed to add category: ${msg}`);
                    } catch (err) {
                      console.error('Error adding category:', err);
                      Alert.alert('Error', `Failed to add category: ${err?.message || String(err)}`);
                    }
                  }}
                  style={{
                    backgroundColor: colors.primary,
                    borderRadius: 12,
                    paddingHorizontal: 20,
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: 'white', fontFamily: 'Inter_500Medium' }}>Add</Text>
                </TouchableOpacity>
              </View>
            </View>

            <Text style={{
              fontFamily: 'Inter_500Medium',
              fontSize: 16,
              color: colors.text,
              marginBottom: 8,
            }}>
              Existing Categories
            </Text>
            {categories.filter(c => c.id !== 'all').map(category => (
              <View
                key={category.id}
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: 12,
                  padding: 16,
                  marginBottom: 12,
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Text style={{
                  fontFamily: 'Inter_500Medium',
                  fontSize: 16,
                  color: colors.text,
                }}>
                  {category.name}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    Alert.alert(
                      'Delete Category',
                      `Are you sure you want to delete "${category.name}"? This cannot be undone.`,
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Delete',
                          style: 'destructive',
                          onPress: async () => {
                            if (!vendorProfile?.id) {
                              Alert.alert('Error', 'Vendor profile not loaded. Please try again.');
                              return;
                            }
                            const result = await vendorService.deleteMenuCategory(vendorProfile.id, category.id);
                            if (!result.error) {
                              await loadMenuData();
                            } else {
                              Alert.alert('Error', 'Failed to delete category. Make sure no items are using it.');
                            }
                          },
                        },
                      ]
                    );
                  }}
                >
                  <Trash2 size={20} color={colors.error || '#FF3B30'} />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}
