import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/utils/auth/useAuth';
import { useTheme } from '@/contexts/ThemeContext';
import { Eye, EyeOff, Mail, Lock, User } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { supabase } from '@/lib/supabase';

export default function AuthScreen() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [userType, setUserType] = useState('student'); // 'student' or 'vendor'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lastRequestTime, setLastRequestTime] = useState(0);

  const { colors, statusBarStyle } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { setAuth } = useAuth();

  const checkRateLimit = () => {
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;
    const minimumDelay = 2000; // 2 seconds between requests
    
    if (timeSinceLastRequest < minimumDelay) {
      const waitTime = Math.ceil((minimumDelay - timeSinceLastRequest) / 1000);
      Alert.alert('Please Wait', `Please wait ${waitTime} seconds before trying again.`);
      return false;
    }
    
    setLastRequestTime(now);
    return true;
  };

  const handleAuthError = (error) => {
    console.error('Auth error:', error);
    
    if (error.message.includes('For security purposes')) {
      Alert.alert(
        'Rate Limited', 
        'Too many requests. Please wait a minute before trying again.',
        [{ text: 'OK' }]
      );
    } else if (error.message.includes('Invalid login credentials')) {
      Alert.alert('Invalid Credentials', 'Please check your email and password.');
    } else if (error.message.includes('User already registered')) {
      Alert.alert('Account Exists', 'An account with this email already exists. Try signing in instead.');
    } else if (error.message.includes('Password should be at least 6 characters')) {
      Alert.alert('Weak Password', 'Password must be at least 6 characters long.');
    } else {
      Alert.alert('Error', error.message || 'An unexpected error occurred. Please try again.');
    }
  };

  const handleSubmit = async () => {
    // Check rate limiting
    if (!checkRateLimit()) {
      return;
    }

    await Haptics.selectionAsync();
    
    if (isSignUp) {
      // Validation for sign up
      const requiredFields = [name.trim(), email.trim(), password.trim()];
      
      // For students, student ID is required. For vendors, business ID is optional
      if (userType === 'student') {
        requiredFields.push(studentId.trim());
      }
      
      if (requiredFields.some(field => !field)) {
        Alert.alert('Error', 'Please fill in all required fields');
        return;
      }
      
      if (password !== confirmPassword) {
        Alert.alert('Error', 'Passwords do not match');
        return;
      }
      
      if (password.length < 6) {
        Alert.alert('Error', 'Password must be at least 6 characters');
        return;
      }
    } else {
      // Validation for sign in
      if (!email.trim() || !password.trim()) {
        Alert.alert('Error', 'Please fill in all fields');
        return;
      }
    }

    setLoading(true);

    try {
      if (isSignUp) {
        // Sign up new user
        const { data: authData, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password: password,
        });

        if (signUpError) {
          throw signUpError;
        }

        if (authData.user) {
          // Create user profile
          const { error: profileError } = await supabase
            .from('users')
            .insert({
              id: authData.user.id,
              email: email.trim(),
              full_name: name.trim(),
              role: userType,
              student_id: userType === 'student' ? studentId.trim() : null,
            });

          if (profileError) {
            throw profileError;
          }

          // If vendor, create vendor profile
          if (userType === 'vendor') {
            const { error: vendorError } = await supabase
              .from('vendor_profiles')
              .insert({
                id: authData.user.id,
                business_name: name.trim() + "'s Kitchen", // Default business name
                address: 'KNUST Campus, Kumasi', // Default address
                business_description: 'Delicious meals made with love',
                business_license: studentId.trim() || null, // Use business ID if provided
              });

            if (vendorError) {
              throw vendorError;
            }
          }

          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          
          // Navigate based on user role
          if (userType === 'vendor') {
            router.replace('/vendor-dashboard');
          } else {
            router.replace('/(tabs)/home');
          }
        }
      } else {
        // Sign in existing user
        const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password,
        });

        if (signInError) {
          throw signInError;
        }

        if (authData.user) {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          
          // Get user profile to determine role (handled by auth state listener)
          const { data: userProfile } = await supabase
            .from('users')
            .select('role')
            .eq('id', authData.user.id)
            .single();

          // Navigate based on user role
          if (userProfile?.role === 'vendor') {
            router.replace('/vendor-dashboard');
          } else {
            router.replace('/(tabs)/home');
          }
        }
      }
    } catch (error) {
      handleAuthError(error);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  const toggleAuthMode = () => {
    setIsSignUp(!isSignUp);
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setName('');
    setStudentId('');
    setShowPassword(false);
  };

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1, backgroundColor: colors.background }} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar style={statusBarStyle} />
      
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: insets.top + 40,
          paddingHorizontal: 24,
          paddingBottom: insets.bottom + 20,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={{ alignItems: 'center', marginBottom: 48 }}>
          <View style={{
            backgroundColor: colors.primary,
            borderRadius: 40,
            width: 80,
            height: 80,
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: 24
          }}>
            <Text style={{
              fontSize: 32,
              fontWeight: 'bold',
              color: 'white'
            }}>
              🍕
            </Text>
          </View>
          
          <Text style={{
            fontFamily: 'Inter_600SemiBold',
            fontSize: 32,
            color: colors.text,
            marginBottom: 8
          }}>
            {isSignUp ? 'Join CampusBite' : 'Welcome Back'}
          </Text>
          
          <Text style={{
            fontFamily: 'Inter_400Regular',
            fontSize: 16,
            color: colors.textSecondary,
            textAlign: 'center',
            lineHeight: 22
          }}>
            {isSignUp 
              ? 'Create your account to start ordering from campus vendors'
              : 'Sign in to your account to continue ordering'
            }
          </Text>
        </View>

        {/* Form */}
        <View style={{ marginBottom: 32 }}>
          {/* User Type Selector (Sign Up Only) */}
          {isSignUp && (
            <View style={{ marginBottom: 20 }}>
              <Text style={{
                fontFamily: 'Inter_500Medium',
                fontSize: 14,
                color: colors.text,
                marginBottom: 8
              }}>
                I am a:
              </Text>
              <View style={{
                flexDirection: 'row',
                backgroundColor: colors.inputBackground,
                borderRadius: 8,
                padding: 4,
              }}>
                <TouchableOpacity
                  onPress={() => setUserType('student')}
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    alignItems: 'center',
                    backgroundColor: userType === 'student' ? colors.primary : 'transparent',
                    borderRadius: 6,
                  }}
                >
                  <Text style={{
                    fontFamily: 'Inter_500Medium',
                    fontSize: 14,
                    color: userType === 'student' ? '#fff' : colors.text,
                  }}>
                    🎓 Student
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  onPress={() => setUserType('vendor')}
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    alignItems: 'center',
                    backgroundColor: userType === 'vendor' ? colors.primary : 'transparent',
                    borderRadius: 6,
                  }}
                >
                  <Text style={{
                    fontFamily: 'Inter_500Medium',
                    fontSize: 14,
                    color: userType === 'vendor' ? '#fff' : colors.text,
                  }}>
                    🏪 Vendor
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Name Field (Sign Up Only) */}
          {isSignUp && (
            <View style={{ marginBottom: 16 }}>
              <Text style={{
                fontFamily: 'Inter_500Medium',
                fontSize: 14,
                color: colors.text,
                marginBottom: 8
              }}>
                Full Name
              </Text>
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 12
              }}>
                <User size={20} color={colors.textSecondary} />
                <TextInput
                  style={{
                    flex: 1,
                    marginLeft: 12,
                    fontFamily: 'Inter_400Regular',
                    fontSize: 16,
                    color: colors.text
                  }}
                  placeholder="Enter your full name"
                  placeholderTextColor={colors.textSecondary}
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                />
              </View>
            </View>
          )}

          {/* ID Field (Sign Up Only) */}
          {isSignUp && (
            <View style={{ marginBottom: 16 }}>
              <Text style={{
                fontFamily: 'Inter_500Medium',
                fontSize: 14,
                color: colors.text,
                marginBottom: 8
              }}>
                {userType === 'student' ? 'Student ID' : 'Business License/ID (Optional)'}
              </Text>
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 12
              }}>
                <Text style={{
                  fontFamily: 'Inter_500Medium',
                  fontSize: 16,
                  color: colors.textSecondary
                }}>
                  #
                </Text>
                <TextInput
                  style={{
                    flex: 1,
                    marginLeft: 12,
                    fontFamily: 'Inter_400Regular',
                    fontSize: 16,
                    color: colors.text
                  }}
                  placeholder={userType === 'student' ? 'Enter your student ID' : 'Enter your business ID'}
                  placeholderTextColor={colors.textSecondary}
                  value={studentId}
                  onChangeText={setStudentId}
                  keyboardType={userType === 'student' ? 'numeric' : 'default'}
                />
              </View>
            </View>
          )}

          {/* Email Field */}
          <View style={{ marginBottom: 16 }}>
            <Text style={{
              fontFamily: 'Inter_500Medium',
              fontSize: 14,
              color: colors.text,
              marginBottom: 8
            }}>
              Email Address
            </Text>
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 12,
              paddingHorizontal: 16,
              paddingVertical: 12
            }}>
              <Mail size={20} color={colors.textSecondary} />
              <TextInput
                style={{
                  flex: 1,
                  marginLeft: 12,
                  fontFamily: 'Inter_400Regular',
                  fontSize: 16,
                  color: colors.text
                }}
                placeholder="Enter your email"
                placeholderTextColor={colors.textSecondary}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          {/* Password Field */}
          <View style={{ marginBottom: isSignUp ? 16 : 24 }}>
            <Text style={{
              fontFamily: 'Inter_500Medium',
              fontSize: 14,
              color: colors.text,
              marginBottom: 8
            }}>
              Password
            </Text>
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 12,
              paddingHorizontal: 16,
              paddingVertical: 12
            }}>
              <Lock size={20} color={colors.textSecondary} />
              <TextInput
                style={{
                  flex: 1,
                  marginLeft: 12,
                  fontFamily: 'Inter_400Regular',
                  fontSize: 16,
                  color: colors.text
                }}
                placeholder="Enter your password"
                placeholderTextColor={colors.textSecondary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={{ marginLeft: 8 }}
              >
                {showPassword ? (
                  <EyeOff size={20} color={colors.textSecondary} />
                ) : (
                  <Eye size={20} color={colors.textSecondary} />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Confirm Password Field (Sign Up Only) */}
          {isSignUp && (
            <View style={{ marginBottom: 24 }}>
              <Text style={{
                fontFamily: 'Inter_500Medium',
                fontSize: 14,
                color: colors.text,
                marginBottom: 8
              }}>
                Confirm Password
              </Text>
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 12
              }}>
                <Lock size={20} color={colors.textSecondary} />
                <TextInput
                  style={{
                    flex: 1,
                    marginLeft: 12,
                    fontFamily: 'Inter_400Regular',
                    fontSize: 16,
                    color: colors.text
                  }}
                  placeholder="Confirm your password"
                  placeholderTextColor={colors.textSecondary}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>
          )}

          {/* Submit Button */}
          <TouchableOpacity
            style={{
              backgroundColor: colors.primary,
              borderRadius: 12,
              paddingVertical: 16,
              alignItems: 'center',
              marginBottom: 24,
              opacity: loading ? 0.7 : 1
            }}
            onPress={handleSubmit}
            disabled={loading}
          >
            <Text style={{
              fontFamily: 'Inter_600SemiBold',
              fontSize: 16,
              color: 'white'
            }}>
              {loading ? 'Please wait...' : (isSignUp ? 'Create Account' : 'Sign In')}
            </Text>
          </TouchableOpacity>

          {/* Toggle Auth Mode */}
          <TouchableOpacity
            style={{ alignItems: 'center' }}
            onPress={toggleAuthMode}
          >
            <Text style={{
              fontFamily: 'Inter_400Regular',
              fontSize: 14,
              color: colors.textSecondary
            }}>
              {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
              <Text style={{ color: colors.primary, fontFamily: 'Inter_500Medium' }}>
                {isSignUp ? 'Sign In' : 'Sign Up'}
              </Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}