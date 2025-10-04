import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { ArrowLeft, User, Mail, Phone, Save, Camera } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/utils/auth/useAuth';
import { supabase } from '@/lib/supabase';
import { useUpload } from '@/utils/useUpload';

export default function EditProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors, statusBarStyle } = useTheme();
  const { auth, setAuth } = useAuth();
  const [upload, { loading: uploadLoading }] = useUpload();
  
  const [formData, setFormData] = useState({
    full_name: auth?.full_name || '',
    email: auth?.email || '',
    student_id: auth?.student_id || '',
    phone: auth?.phone || '',
    year: auth?.year || '',
    department: auth?.department || '',
    avatar_url: auth?.avatar_url || null,
  });
  const [loading, setLoading] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);

  const handleGoBack = async () => {
    await Haptics.selectionAsync();
    router.back();
  };

  const handleSave = async () => {
    await Haptics.selectionAsync();
    
    // Basic validation
    if (!formData.full_name.trim() || !formData.email.trim()) {
      Alert.alert('Error', 'Please fill in all required fields (Name, Email)');
      return;
    }

    if (!auth?.id) {
      Alert.alert('Error', 'User session not found. Please sign in again.');
      return;
    }

    setLoading(true);

    try {
      // Update user profile in Supabase
      const { data, error } = await supabase
        .from('users')
        .update({
          full_name: formData.full_name,
          phone: formData.phone,
          student_id: formData.student_id,
          year: formData.year,
          department: formData.department,
          avatar_url: formData.avatar_url,
          updated_at: new Date().toISOString(),
        })
        .eq('id', auth.id)
        .select()
        .single();

      if (error) {
        throw error;
      }
      
      // Update local auth state
      const updatedAuth = {
        ...auth,
        ...data,
      };
      setAuth(updatedAuth);
      
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        'Profile Updated',
        'Your profile has been successfully updated.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
      
    } catch (error) {
      console.error('Update error:', error);
      Alert.alert('Error', error.message || 'Failed to update profile. Please try again.');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  const handlePickImage = async (useCamera = false) => {
    try {
      // Request permissions
      const permissionResult = useCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permissionResult.granted) {
        Alert.alert(
          'Permission Required',
          `We need ${useCamera ? 'camera' : 'photo library'} access to update your profile picture.`
        );
        return;
      }

      // Launch picker
      const result = useCamera
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
          });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        setImageLoading(true);
        await Haptics.selectionAsync();

        // Upload image
        const uploadResult = await upload({
          reactNativeAsset: {
            uri: asset.uri,
            name: asset.fileName || `avatar-${Date.now()}.jpg`,
            mimeType: asset.mimeType || 'image/jpeg',
          },
        });

        if (uploadResult.error) {
          Alert.alert('Upload Error', uploadResult.error);
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } else {
          // Update form data with new avatar URL
          setFormData({ ...formData, avatar_url: uploadResult.url });
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        setImageLoading(false);
      }
    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
      setImageLoading(false);
    }
  };

  const handleProfilePicture = async () => {
    await Haptics.selectionAsync();
    Alert.alert(
      'Change Profile Picture',
      'Choose how you\'d like to update your profile picture:',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Take Photo', onPress: () => handlePickImage(true) },
        { text: 'Choose from Library', onPress: () => handlePickImage(false) },
      ]
    );
  };

  const renderFormField = (icon, label, placeholder, value, onChangeText, keyboardType = 'default', required = false) => (
    <View style={{ marginBottom: 20 }}>
      <Text style={{
        fontFamily: 'Inter_500Medium',
        fontSize: 14,
        color: colors.text,
        marginBottom: 8,
      }}>
        {label} {required && <Text style={{ color: colors.error }}>*</Text>}
      </Text>
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
      }}>
        {icon}
        <TextInput
          style={{
            flex: 1,
            marginLeft: 12,
            fontFamily: 'Inter_400Regular',
            fontSize: 16,
            color: colors.text,
          }}
          placeholder={placeholder}
          placeholderTextColor={colors.textSecondary}
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          autoCapitalize={keyboardType === 'email-address' ? 'none' : 'words'}
          autoCorrect={false}
        />
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1, backgroundColor: colors.background }} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar style={statusBarStyle} />

      {/* Header */}
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
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingHorizontal: 24,
            paddingVertical: 16,
          }}
        >
          <TouchableOpacity
            style={{
              width: 44,
              height: 44,
              justifyContent: 'center',
              alignItems: 'center',
            }}
            onPress={handleGoBack}
          >
            <ArrowLeft size={24} color={colors.text} />
          </TouchableOpacity>
          
          <Text style={{
            fontFamily: 'Inter_600SemiBold',
            fontSize: 18,
            color: colors.text,
            flex: 1,
            textAlign: 'center',
            marginHorizontal: 16,
          }}>
            Edit Profile
          </Text>
          
          <TouchableOpacity
            style={{
              backgroundColor: colors.primary,
              borderRadius: 8,
              paddingHorizontal: 12,
              paddingVertical: 8,
              opacity: loading ? 0.7 : 1,
            }}
            onPress={handleSave}
            disabled={loading}
          >
            <Save size={18} color="white" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingTop: 32,
          paddingBottom: insets.bottom + 20,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Picture Section */}
        <View style={{ alignItems: 'center', marginBottom: 32 }}>
          <View style={{
            width: 100,
            height: 100,
            borderRadius: 50,
            backgroundColor: colors.primary,
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: 16,
            overflow: 'hidden',
          }}>
            {imageLoading ? (
              <ActivityIndicator size="large" color="white" />
            ) : formData.avatar_url ? (
              <Image
                source={{ uri: formData.avatar_url }}
                style={{ width: '100%', height: '100%' }}
                contentFit="cover"
              />
            ) : (
              <Text style={{
                fontFamily: 'Inter_600SemiBold',
                fontSize: 36,
                color: 'white',
              }}>
                {formData.full_name?.charAt(0)?.toUpperCase() || 'U'}
              </Text>
            )}
          </View>
          
          <TouchableOpacity
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: colors.surface,
              borderRadius: 20,
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderWidth: 1,
              borderColor: colors.border,
              opacity: imageLoading ? 0.5 : 1,
            }}
            onPress={handleProfilePicture}
            disabled={imageLoading}
          >
            <Camera size={16} color={colors.primary} />
            <Text style={{
              fontFamily: 'Inter_500Medium',
              fontSize: 14,
              color: colors.primary,
              marginLeft: 8,
            }}>
              {imageLoading ? 'Uploading...' : 'Change Photo'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Basic Information */}
        <View style={{ marginBottom: 32 }}>
          <Text style={{
            fontFamily: 'Inter_600SemiBold',
            fontSize: 18,
            color: colors.text,
            marginBottom: 20,
          }}>
            Basic Information
          </Text>

          {renderFormField(
            <User size={20} color={colors.textSecondary} />,
            'Full Name',
            'Enter your full name',
            formData.full_name,
            (text) => setFormData({ ...formData, full_name: text }),
            'default',
            true
          )}

          {renderFormField(
            <Mail size={20} color={colors.textSecondary} />,
            'Email Address',
            'Enter your email address',
            formData.email,
            (text) => setFormData({ ...formData, email: text }),
            'email-address',
            true
          )}

          {renderFormField(
            <User size={20} color={colors.textSecondary} />,
            'Student ID',
            'Enter your student ID',
            formData.student_id,
            (text) => setFormData({ ...formData, student_id: text }),
            'default',
            false
          )}

          {renderFormField(
            <Phone size={20} color={colors.textSecondary} />,
            'Phone Number',
            'Enter your phone number',
            formData.phone,
            (text) => setFormData({ ...formData, phone: text }),
            'phone-pad'
          )}
        </View>

        {/* Academic Information */}
        <View style={{ marginBottom: 32 }}>
          <Text style={{
            fontFamily: 'Inter_600SemiBold',
            fontSize: 18,
            color: colors.text,
            marginBottom: 20,
          }}>
            Academic Information
          </Text>

          {renderFormField(
            <User size={20} color={colors.textSecondary} />,
            'Year of Study',
            'e.g., First Year, Second Year',
            formData.year,
            (text) => setFormData({ ...formData, year: text })
          )}

          {renderFormField(
            <User size={20} color={colors.textSecondary} />,
            'Department',
            'e.g., Computer Science, Engineering',
            formData.department,
            (text) => setFormData({ ...formData, department: text })
          )}
        </View>

        {/* Account Security */}
        <View style={{ marginBottom: 32 }}>
          <Text style={{
            fontFamily: 'Inter_600SemiBold',
            fontSize: 18,
            color: colors.text,
            marginBottom: 16,
          }}>
            Account Security
          </Text>

          <TouchableOpacity
            style={{
              backgroundColor: colors.surface,
              borderRadius: 12,
              padding: 16,
              borderWidth: 1,
              borderColor: colors.border,
            }}
            onPress={() => Alert.alert('Coming Soon', 'Password change will be available soon!')}
          >
            <Text style={{
              fontFamily: 'Inter_500Medium',
              fontSize: 16,
              color: colors.text,
              marginBottom: 4,
            }}>
              Change Password
            </Text>
            <Text style={{
              fontFamily: 'Inter_400Regular',
              fontSize: 14,
              color: colors.textSecondary,
            }}>
              Update your account password
            </Text>
          </TouchableOpacity>
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={{
            backgroundColor: colors.primary,
            borderRadius: 12,
            paddingVertical: 16,
            alignItems: 'center',
            marginBottom: 20,
            opacity: loading ? 0.7 : 1,
          }}
          onPress={handleSave}
          disabled={loading}
        >
          <Text style={{
            fontFamily: 'Inter_600SemiBold',
            fontSize: 16,
            color: 'white',
          }}>
            {loading ? 'Saving...' : 'Save Changes'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}