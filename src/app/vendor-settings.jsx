import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { 
  ArrowLeft,
  Store,
  Clock,
  MapPin,
  Bell,
  DollarSign,
  Truck,
  Phone,
  Mail,
  Edit3,
  ChevronRight,
  Settings as SettingsIcon,
  User,
  Lock,
  LogOut,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/utils/auth/useAuth';
import vendorService from '@/lib/vendorService';

export default function VendorSettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors, statusBarStyle } = useTheme();
  const { auth, signOut } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [vendorProfile, setVendorProfile] = useState(null);
  const [settings, setSettings] = useState({
    restaurantName: '',
    description: '',
    phone: '',
    email: '',
    address: '',
    isOpen: true,
    acceptsOrders: true,
    notificationsEnabled: true,
    emailNotifications: false,
    deliveryRadius: 5,
    minimumOrder: 0,
    deliveryFee: 0,
    operatingHours: {
      monday: { open: '08:00', close: '20:00', isOpen: true },
      tuesday: { open: '08:00', close: '20:00', isOpen: true },
      wednesday: { open: '08:00', close: '20:00', isOpen: true },
      thursday: { open: '08:00', close: '20:00', isOpen: true },
      friday: { open: '08:00', close: '22:00', isOpen: true },
      saturday: { open: '10:00', close: '22:00', isOpen: true },
      sunday: { open: '10:00', close: '18:00', isOpen: false },
    },
  });

  // Load vendor settings from database
  useEffect(() => {
    loadVendorSettings();
  }, [auth?.id]);

  const loadVendorSettings = async () => {
    try {
      if (!auth?.id) return;

      setLoading(true);

      // Get vendor profile and settings
      const profileResult = await vendorService.getVendorSettings(auth.id);
      
      if (profileResult.error) throw profileResult.error;

      const profile = profileResult.data;
      setVendorProfile(profile);

      // Map database fields to settings state
      setSettings({
        restaurantName: profile.business_name || '',
        description: profile.business_description || '',
        phone: profile.business_phone || profile.users?.phone || '',
        email: profile.business_email || profile.users?.email || '',
        address: profile.address || '',
        isOpen: profile.is_active ?? true,
        acceptsOrders: profile.is_accepting_orders ?? true,
        notificationsEnabled: profile.push_notifications_enabled ?? true,
        emailNotifications: profile.email_notifications_enabled ?? false,
        deliveryRadius: profile.delivery_radius || 5,
        minimumOrder: parseFloat(profile.minimum_order_amount) || 0,
        deliveryFee: parseFloat(profile.delivery_fee) || 0,
        operatingHours: mapOperatingHours(profile.vendor_operating_hours || []),
      });

    } catch (error) {
      console.error('Error loading vendor settings:', error);
      Alert.alert('Error', 'Failed to load settings. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const mapOperatingHours = (hoursArray) => {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const mapped = {
      monday: { open: '08:00', close: '20:00', isOpen: true },
      tuesday: { open: '08:00', close: '20:00', isOpen: true },
      wednesday: { open: '08:00', close: '20:00', isOpen: true },
      thursday: { open: '08:00', close: '20:00', isOpen: true },
      friday: { open: '08:00', close: '22:00', isOpen: true },
      saturday: { open: '10:00', close: '22:00', isOpen: true },
      sunday: { open: '10:00', close: '18:00', isOpen: false },
    };

    hoursArray.forEach(hour => {
      const dayName = days[hour.day_of_week];
      if (dayName) {
        mapped[dayName] = {
          open: hour.open_time || '08:00',
          close: hour.close_time || '20:00',
          isOpen: hour.is_open ?? true,
        };
      }
    });

    return mapped;
  };

  const handleToggle = async (key) => {
    await Haptics.selectionAsync();
    const newValue = !settings[key];
    setSettings(prev => ({ ...prev, [key]: newValue }));
    
    // Auto-save for database-backed toggles
    if (key === 'isOpen' || key === 'acceptsOrders' || key === 'notificationsEnabled' || key === 'emailNotifications') {
      try {
        if (!vendorProfile?.id) return;
        
        const updateData = {};
        if (key === 'isOpen') {
          updateData.is_active = newValue;
        } else if (key === 'acceptsOrders') {
          updateData.is_accepting_orders = newValue;
        } else if (key === 'notificationsEnabled') {
          updateData.push_notifications_enabled = newValue;
        } else if (key === 'emailNotifications') {
          updateData.email_notifications_enabled = newValue;
        }
        
        const result = await vendorService.updateVendorProfile(vendorProfile.id, updateData);
        
        if (result.error) {
          console.error('Error auto-saving toggle:', result.error);
          // Revert on error
          setSettings(prev => ({ ...prev, [key]: !newValue }));
          Alert.alert('Error', 'Failed to save setting');
        } else {
          // Update vendor profile with saved data
          setVendorProfile(prev => ({
            ...prev,
            ...result.data
          }));
        }
      } catch (error) {
        console.error('Error auto-saving toggle:', error);
        // Revert on error
        setSettings(prev => ({ ...prev, [key]: !newValue }));
        Alert.alert('Error', 'Failed to save setting');
      }
    }
  };

  const handleHoursToggle = async (day) => {
    await Haptics.selectionAsync();
    
    const oldValue = settings.operatingHours[day].isOpen;
    const newValue = !oldValue;
    
    // Update local state immediately
    setSettings(prev => ({
      ...prev,
      operatingHours: {
        ...prev.operatingHours,
        [day]: {
          ...prev.operatingHours[day],
          isOpen: newValue
        }
      }
    }));

    // Save to database
    try {
      // Map day name to day_of_week number (0=Sunday, 1=Monday, etc.)
      const dayMap = {
        sunday: 0,
        monday: 1,
        tuesday: 2,
        wednesday: 3,
        thursday: 4,
        friday: 5,
        saturday: 6
      };

      const result = await vendorService.updateOperatingHours(
        vendorProfile.id,
        dayMap[day],
        {
          isOpen: newValue,
          open: settings.operatingHours[day].open,
          close: settings.operatingHours[day].close
        }
      );

      if (result.error) {
        console.error('Failed to save operating hours:', result.error);
        // Revert on error
        setSettings(prev => ({
          ...prev,
          operatingHours: {
            ...prev.operatingHours,
            [day]: {
              ...prev.operatingHours[day],
              isOpen: oldValue
            }
          }
        }));
        Alert.alert('Error', 'Failed to update operating hours');
      } else {
        console.log('Operating hours updated successfully:', result.data);
      }
    } catch (error) {
      console.error('Error saving operating hours:', error);
      // Revert on error
      setSettings(prev => ({
        ...prev,
        operatingHours: {
          ...prev.operatingHours,
          [day]: {
            ...prev.operatingHours[day],
            isOpen: oldValue
          }
        }
      }));
      Alert.alert('Error', 'Failed to update operating hours');
    }
  };

  const handleSaveSettings = async () => {
    try {
      // If vendor profile doesn't exist yet, create it instead of updating
      const isCreating = !vendorProfile?.id;

      setSaving(true);

      // Prepare data for update
      const updateData = {
        business_name: settings.restaurantName,
        business_description: settings.description,
        business_phone: settings.phone,
        business_email: settings.email,
        address: settings.address,
        is_active: settings.isOpen,
        is_accepting_orders: settings.acceptsOrders,
        delivery_radius: parseFloat(settings.deliveryRadius) || 5.0,
        minimum_order_amount: parseFloat(settings.minimumOrder) || 0.00,
        delivery_fee: parseFloat(settings.deliveryFee) || 0.00,
      };

      console.log('Updating vendor profile:', vendorProfile.id);
      console.log('Update data:', updateData);

      // Create or update vendor profile
      let result;
      if (isCreating) {
        result = await vendorService.createVendorProfile(auth.id, updateData);
      } else {
        result = await vendorService.updateVendorProfile(vendorProfile.id, updateData);
      }

      console.log('Update result:', result);

      if (result.error) {
        console.error('Update error details:', result.error);
        throw result.error;
      }

      // Success!
      console.log('Settings saved successfully!');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      // Update local vendor profile with the saved data
      setVendorProfile(prev => ({
        ...prev,
        ...result.data
      }));
      
      Alert.alert('Success', 'Your restaurant settings have been updated successfully.');

    } catch (error) {
      console.error('Error saving settings:', error);
      console.error('Error message:', error.message);
      console.error('Error details:', JSON.stringify(error, null, 2));
      Alert.alert('Error', `Failed to save settings: ${error.message || 'Please try again.'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Sign Out', 
          style: 'destructive',
          onPress: () => {
            signOut();
            router.replace('/auth');
          }
        },
      ]
    );
  };

  const renderMenuItem = (icon, title, subtitle, onPress, rightElement) => (
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

  const renderInputField = (label, value, onChangeText, placeholder, keyboardType = 'default') => (
    <View style={{ marginBottom: 20 }}>
      <Text style={{
        fontFamily: 'Inter_500Medium',
        fontSize: 16,
        color: colors.text,
        marginBottom: 8,
      }}>
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textSecondary}
        keyboardType={keyboardType}
        style={{
          backgroundColor: colors.surface,
          borderRadius: 12,
          paddingHorizontal: 16,
          paddingVertical: 12,
          fontFamily: 'Inter_400Regular',
          fontSize: 16,
          color: colors.text,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      />
    </View>
  );

  const renderOperatingHours = () => (
    <View style={{
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 20,
      marginBottom: 24,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    }}>
      <Text style={{
        fontFamily: 'Inter_600SemiBold',
        fontSize: 18,
        color: colors.text,
        marginBottom: 16,
      }}>
        Operating Hours
      </Text>

      {Object.entries(settings.operatingHours).map(([day, hours]) => (
        <View key={day} style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
        }}>
          <View style={{ flex: 1 }}>
            <Text style={{
              fontFamily: 'Inter_500Medium',
              fontSize: 16,
              color: colors.text,
              textTransform: 'capitalize',
            }}>
              {day}
            </Text>
            <Text style={{
              fontFamily: 'Inter_400Regular',
              fontSize: 14,
              color: colors.textSecondary,
            }}>
              {hours.isOpen ? `${hours.open} - ${hours.close}` : 'Closed'}
            </Text>
          </View>
          
          <Switch
            value={hours.isOpen}
            onValueChange={() => handleHoursToggle(day)}
            trackColor={{ false: colors.textMuted, true: colors.primary }}
            thumbColor={'white'}
          />
        </View>
      ))}
    </View>
  );

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
          justifyContent: 'space-between',
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
            }}
          >
            <ArrowLeft size={20} color={colors.text} />
          </TouchableOpacity>

          <Text style={{
            fontFamily: 'Inter_600SemiBold',
            fontSize: 24,
            color: colors.text,
          }}>
            Settings
          </Text>

          <TouchableOpacity
            onPress={handleSaveSettings}
            disabled={saving}
            style={{
              backgroundColor: colors.primary,
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderRadius: 20,
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={{
                fontFamily: 'Inter_500Medium',
                fontSize: 14,
                color: '#fff',
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
        showsVerticalScrollIndicator={false}
      >
        {/* Loading State */}
        {loading && (
          <View style={{ 
            flex: 1, 
            justifyContent: 'center', 
            alignItems: 'center', 
            paddingVertical: 100 
          }}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={{
              fontFamily: 'Inter_400Regular',
              fontSize: 14,
              color: colors.textSecondary,
              marginTop: 16,
            }}>
              Loading settings...
            </Text>
          </View>
        )}

        {/* Content - only show if not loading */}
        {!loading && (
          <>
        {/* Restaurant Information */}
        <View style={{ marginBottom: 32 }}>
          <Text style={{
            fontFamily: 'Inter_600SemiBold',
            fontSize: 18,
            color: colors.text,
            marginBottom: 16,
          }}>
            Restaurant Information
          </Text>

          {renderInputField(
            'Restaurant Name',
            settings.restaurantName,
            (text) => setSettings(prev => ({ ...prev, restaurantName: text })),
            'Enter restaurant name'
          )}

          {renderInputField(
            'Description',
            settings.description,
            (text) => setSettings(prev => ({ ...prev, description: text })),
            'Describe your restaurant'
          )}

          {renderInputField(
            'Phone Number',
            settings.phone,
            (text) => setSettings(prev => ({ ...prev, phone: text })),
            '+233 XX XXX XXXX',
            'phone-pad'
          )}

          {renderInputField(
            'Email Address',
            settings.email,
            (text) => setSettings(prev => ({ ...prev, email: text })),
            'restaurant@example.com',
            'email-address'
          )}

          {renderInputField(
            'Address',
            settings.address,
            (text) => setSettings(prev => ({ ...prev, address: text })),
            'Enter restaurant address'
          )}
        </View>

        {/* Operating Hours */}
        {renderOperatingHours()}

        {/* Business Settings */}
        <View style={{ marginBottom: 32 }}>
          <Text style={{
            fontFamily: 'Inter_600SemiBold',
            fontSize: 18,
            color: colors.text,
            marginBottom: 16,
          }}>
            Business Settings
          </Text>

          {renderMenuItem(
            <Store size={20} color={colors.primary} />,
            'Restaurant Status',
            settings.isOpen ? 'Currently open for orders' : 'Currently closed',
            () => handleToggle('isOpen'),
            <Switch
              value={settings.isOpen}
              onValueChange={() => handleToggle('isOpen')}
              trackColor={{ false: colors.textMuted, true: colors.primary }}
              thumbColor={'white'}
            />
          )}

          {renderMenuItem(
            <Truck size={20} color={colors.primary} />,
            'Accept Orders',
            settings.acceptsOrders ? 'Accepting new orders' : 'Not accepting orders',
            () => handleToggle('acceptsOrders'),
            <Switch
              value={settings.acceptsOrders}
              onValueChange={() => handleToggle('acceptsOrders')}
              trackColor={{ false: colors.textMuted, true: colors.primary }}
              thumbColor={'white'}
            />
          )}

          <View style={{
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
              marginBottom: 16,
            }}>
              {renderInputField(
                'Delivery Radius (km)',
                settings.deliveryRadius.toString(),
                (text) => setSettings(prev => ({ ...prev, deliveryRadius: parseFloat(text) || 0 })),
                '5',
                'decimal-pad'
              )}
            </View>

            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
            }}>
              <View style={{ flex: 1, marginRight: 12 }}>
                {renderInputField(
                  'Minimum Order (₵)',
                  settings.minimumOrder.toString(),
                  (text) => setSettings(prev => ({ ...prev, minimumOrder: parseFloat(text) || 0 })),
                  '15.00',
                  'decimal-pad'
                )}
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                {renderInputField(
                  'Delivery Fee (₵)',
                  settings.deliveryFee.toString(),
                  (text) => setSettings(prev => ({ ...prev, deliveryFee: parseFloat(text) || 0 })),
                  '5.00',
                  'decimal-pad'
                )}
              </View>
            </View>
          </View>
        </View>

        {/* Notifications */}
        <View style={{ marginBottom: 32 }}>
          <Text style={{
            fontFamily: 'Inter_600SemiBold',
            fontSize: 18,
            color: colors.text,
            marginBottom: 16,
          }}>
            Notifications
          </Text>

          {renderMenuItem(
            <Bell size={20} color={colors.primary} />,
            'Push Notifications',
            'Order updates and alerts',
            () => handleToggle('notificationsEnabled'),
            <Switch
              value={settings.notificationsEnabled}
              onValueChange={() => handleToggle('notificationsEnabled')}
              trackColor={{ false: colors.textMuted, true: colors.primary }}
              thumbColor={'white'}
            />
          )}

          {renderMenuItem(
            <Mail size={20} color={colors.primary} />,
            'Email Notifications',
            'Daily reports and summaries',
            () => handleToggle('emailNotifications'),
            <Switch
              value={settings.emailNotifications}
              onValueChange={() => handleToggle('emailNotifications')}
              trackColor={{ false: colors.textMuted, true: colors.primary }}
              thumbColor={'white'}
            />
          )}
        </View>

        {/* Account Settings */}
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
            <User size={20} color={colors.primary} />,
            'Profile Settings',
            'Update personal information',
            () => console.log('Edit profile')
          )}

          {renderMenuItem(
            <Lock size={20} color={colors.primary} />,
            'Change Password',
            'Update your password',
            () => console.log('Change password')
          )}

          {renderMenuItem(
            <LogOut size={20} color="#FF3B30" />,
            'Sign Out',
            'Sign out of your account',
            handleLogout,
            null
          )}
        </View>
        </>
        )}
      </ScrollView>
    </View>
  );
}