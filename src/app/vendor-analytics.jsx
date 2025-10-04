import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { 
  ArrowLeft,
  TrendingUp,
  DollarSign,
  ShoppingBag,
  Users,
  Clock,
  Star,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/utils/auth/useAuth';
import vendorService from '@/lib/vendorService';

export default function VendorAnalyticsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors, statusBarStyle } = useTheme();
  const { auth } = useAuth();
  const [selectedPeriod, setSelectedPeriod] = useState('week');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [analytics, setAnalytics] = useState(null);
  const [vendorProfile, setVendorProfile] = useState(null);
  const [error, setError] = useState(null);

  const periods = [
    { id: 'day', name: 'Today', apiValue: 'today' },
    { id: 'week', name: 'This Week', apiValue: 'week' },
    { id: 'month', name: 'This Month', apiValue: 'month' },
  ];

  // Load analytics data
  const loadAnalytics = async () => {
    try {
      if (!auth?.id) return;
      
      setError(null);
      
      // Get vendor profile first
      const profileResult = await vendorService.getVendorProfile(auth.id);
      if (profileResult.error) throw profileResult.error;
      setVendorProfile(profileResult.data);

      // Get analytics for selected period
      const period = periods.find(p => p.id === selectedPeriod);
      const analyticsResult = await vendorService.getVendorAnalytics(
        profileResult.data.id, 
        period?.apiValue || 'week'
      );
      
      if (analyticsResult.error) throw analyticsResult.error;
      setAnalytics(analyticsResult.data);
    } catch (err) {
      console.error('Error loading analytics:', err);
      setError(err.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, [auth?.id, selectedPeriod]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAnalytics();
  };

  const handlePeriodChange = async (period) => {
    await Haptics.selectionAsync();
    setSelectedPeriod(period.id);
  };

  const formatCurrency = (amount) => {
    return `₵${amount.toFixed(2)}`;
  };

  const renderMetricCard = (icon, title, value, subtitle = '') => (
    <View style={{
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 20,
      flex: 1,
      marginHorizontal: 4,
      marginBottom: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    }}>
      <View style={{
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.primary + '20',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
      }}>
        {icon}
      </View>
      
      <Text style={{
        fontFamily: 'Inter_400Regular',
        fontSize: 13,
        color: colors.textSecondary,
        marginBottom: 4,
      }}>
        {title}
      </Text>
      
      <Text style={{
        fontFamily: 'Inter_600SemiBold',
        fontSize: 24,
        color: colors.text,
        marginBottom: 4,
      }}>
        {value}
      </Text>

      {subtitle !== '' && (
        <Text style={{
          fontFamily: 'Inter_400Regular',
          fontSize: 12,
          color: colors.textSecondary,
        }}>
          {subtitle}
        </Text>
      )}
    </View>
  );

  const renderPeriodTab = (period) => (
    <TouchableOpacity
      key={period.id}
      style={{
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 20,
        backgroundColor: selectedPeriod === period.id ? colors.primary : colors.surface,
        marginRight: 8,
      }}
      onPress={() => handlePeriodChange(period)}
    >
      <Text style={{
        fontFamily: 'Inter_500Medium',
        fontSize: 14,
        color: selectedPeriod === period.id ? 'white' : colors.text,
      }}>
        {period.name}
      </Text>
    </TouchableOpacity>
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
          marginBottom: 20,
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
            Sales Analytics
          </Text>
        </View>

        {/* Period Selector */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingRight: 24 }}
        >
          {periods.map(renderPeriodTab)}
        </ScrollView>
      </View>

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
        {/* Loading State */}
        {loading && (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 100 }}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={{
              fontFamily: 'Inter_400Regular',
              fontSize: 14,
              color: colors.textSecondary,
              marginTop: 16,
            }}>
              Loading analytics...
            </Text>
          </View>
        )}

        {/* Error State */}
        {error && !loading && (
          <View style={{ flex: 1, alignItems: 'center', paddingVertical: 60 }}>
            <Text style={{ fontSize: 48, marginBottom: 16 }}>📊</Text>
            <Text style={{
              fontFamily: 'Inter_600SemiBold',
              fontSize: 18,
              color: colors.text,
              marginBottom: 8,
            }}>
              Failed to Load Analytics
            </Text>
            <Text style={{
              fontFamily: 'Inter_400Regular',
              fontSize: 14,
              color: colors.textSecondary,
              marginBottom: 24,
              textAlign: 'center',
            }}>
              {error}
            </Text>
            <TouchableOpacity
              style={{
                backgroundColor: colors.primary,
                borderRadius: 12,
                paddingHorizontal: 24,
                paddingVertical: 12,
              }}
              onPress={loadAnalytics}
            >
              <Text style={{
                fontFamily: 'Inter_600SemiBold',
                fontSize: 14,
                color: 'white',
              }}>
                Try Again
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Content - only show if not loading and no error */}
        {!loading && !error && analytics && (
          <>
            {/* Key Metrics Grid */}
            <View style={{ marginBottom: 24 }}>
              <Text style={{
                fontFamily: 'Inter_600SemiBold',
                fontSize: 18,
                color: colors.text,
                marginBottom: 16,
              }}>
                Key Metrics
              </Text>

              <View style={{
                flexDirection: 'row',
                marginHorizontal: -4,
              }}>
                {renderMetricCard(
                  <DollarSign size={20} color={colors.primary} />,
                  'Revenue',
                  formatCurrency(analytics.totalRevenue || 0),
                  `${periods.find(p => p.id === selectedPeriod)?.name || ''}`
                )}
                {renderMetricCard(
                  <ShoppingBag size={20} color={colors.primary} />,
                  'Orders',
                  analytics.totalOrders || 0,
                  `${periods.find(p => p.id === selectedPeriod)?.name || ''}`
                )}
              </View>

              <View style={{
                flexDirection: 'row',
                marginHorizontal: -4,
              }}>
                {renderMetricCard(
                  <Users size={20} color={colors.primary} />,
                  'Customers',
                  analytics.newCustomers || 0,
                  'Unique customers'
                )}
                {renderMetricCard(
                  <TrendingUp size={20} color={colors.primary} />,
                  'Avg Order',
                  formatCurrency(analytics.avgOrderValue || 0),
                  'Per order'
                )}
              </View>

              {vendorProfile && (
                <View style={{
                  flexDirection: 'row',
                  marginHorizontal: -4,
                }}>
                  {renderMetricCard(
                    <Star size={20} color={colors.primary} />,
                    'Rating',
                    vendorProfile.rating?.toFixed(1) || '0.0',
                    '/5.0'
                  )}
                  {renderMetricCard(
                    <Clock size={20} color={colors.primary} />,
                    'Status',
                    vendorProfile.is_active ? 'Open' : 'Closed',
                    vendorProfile.is_accepting_orders ? 'Accepting orders' : 'Not accepting orders'
                  )}
                </View>
              )}
            </View>

            {/* Order Status Breakdown */}
            {analytics.statusBreakdown && Object.keys(analytics.statusBreakdown).length > 0 && (
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
                  Order Status Breakdown
                </Text>

                {Object.entries(analytics.statusBreakdown).map(([status, count]) => (
                  <View key={status} style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingVertical: 12,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                  }}>
                    <Text style={{
                      fontFamily: 'Inter_500Medium',
                      fontSize: 14,
                      color: colors.text,
                      textTransform: 'capitalize',
                    }}>
                      {status}
                    </Text>
                    <Text style={{
                      fontFamily: 'Inter_600SemiBold',
                      fontSize: 16,
                      color: colors.primary,
                    }}>
                      {count}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Performance Insights */}
            <View style={{
              backgroundColor: colors.surface,
              borderRadius: 16,
              padding: 20,
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
                Performance Insights
              </Text>

              {analytics.totalOrders > 0 ? (
                <View style={{
                  backgroundColor: colors.primary + '10',
                  borderRadius: 12,
                  padding: 16,
                  marginBottom: 12,
                }}>
                  <Text style={{
                    fontFamily: 'Inter_500Medium',
                    fontSize: 14,
                    color: colors.text,
                    marginBottom: 4,
                  }}>
                    📊 Sales Summary
                  </Text>
                  <Text style={{
                    fontFamily: 'Inter_400Regular',
                    fontSize: 13,
                    color: colors.textSecondary,
                  }}>
                    You've processed {analytics.totalOrders} orders with total revenue of {formatCurrency(analytics.totalRevenue)}.
                  </Text>
                </View>
              ) : (
                <View style={{
                  backgroundColor: '#FF9500' + '10',
                  borderRadius: 12,
                  padding: 16,
                  marginBottom: 12,
                }}>
                  <Text style={{
                    fontFamily: 'Inter_500Medium',
                    fontSize: 14,
                    color: colors.text,
                    marginBottom: 4,
                  }}>
                    💡 No Orders Yet
                  </Text>
                  <Text style={{
                    fontFamily: 'Inter_400Regular',
                    fontSize: 13,
                    color: colors.textSecondary,
                  }}>
                    Start accepting orders to see your analytics here!
                  </Text>
                </View>
              )}

              {analytics.avgOrderValue > 0 && (
                <View style={{
                  backgroundColor: '#34C759' + '10',
                  borderRadius: 12,
                  padding: 16,
                }}>
                  <Text style={{
                    fontFamily: 'Inter_500Medium',
                    fontSize: 14,
                    color: colors.text,
                    marginBottom: 4,
                  }}>
                    💰 Average Order Value
                  </Text>
                  <Text style={{
                    fontFamily: 'Inter_400Regular',
                    fontSize: 13,
                    color: colors.textSecondary,
                  }}>
                    Your average order value is {formatCurrency(analytics.avgOrderValue)}. Keep up the great work!
                  </Text>
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}
