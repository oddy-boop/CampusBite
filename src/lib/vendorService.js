// Vendor-specific Supabase operations
import { supabase } from '@/lib/supabase';

export const vendorService = {
  // Get vendor profile and basic info
  async getVendorProfile(userId) {
    try {
      // 1) Try to find by primary key (id)
      let { data, error } = await supabase
        .from('vendor_profiles')
        .select(`
          *,
          users!id(id, email, full_name, phone),
          vendor_operating_hours(*)
        `)
        .eq('id', userId)
        .maybeSingle();

      if (error) throw error;

      // 2) If not found, try lookup by owner_user_id (for legacy profiles linked to a different PK)
      // Note: owner_user_id-based lookups are optional and require a schema migration.
      // If the DB hasn't been migrated yet, skip owner_user_id lookup and rely on
      // email/phone fallback below.

      // 3) If still not found, try matching by the authenticated user's email/phone
      if (!data) {
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          const userEmail = sessionData?.session?.user?.email;
          const userPhone = sessionData?.session?.user?.phone;

          if (userEmail) {
            const { data: byEmail, error: byEmailErr } = await supabase
              .from('vendor_profiles')
              .select(`
                *,
                users!id(id, email, full_name, phone),
                vendor_operating_hours(*)
              `)
              .ilike('business_email', userEmail)
              .maybeSingle();
            if (byEmailErr) console.warn('[vendorService] getVendorProfile email lookup failed', byEmailErr);
            if (byEmail) data = byEmail;
          }

          if (!data && userPhone) {
            const normalizedPhone = userPhone.replace(/[^0-9]/g, '');
            const { data: byPhone, error: byPhoneErr } = await supabase
              .from('vendor_profiles')
              .select(`
                *,
                users!id(id, email, full_name, phone),
                vendor_operating_hours(*)
              `)
              .filter('business_phone', 'ilike', `%${normalizedPhone}%`)
              .maybeSingle();
            if (byPhoneErr) console.warn('[vendorService] getVendorProfile phone lookup failed', byPhoneErr);
            if (byPhone) data = byPhone;
          }
        } catch (sessErr) {
          console.warn('[vendorService] session lookup failed during vendor profile fallback', sessErr);
        }
      }

      return { data, error: null };
    } catch (error) {
      console.error('Error fetching vendor profile:', error);
      return { data: null, error };
    }
  },

  // Create a vendor profile (used when vendor has not set up a profile yet)
  async createVendorProfile(userId, profileData) {
    try {
      const payload = {
        id: userId,
        business_name: profileData.business_name || 'My Stall',
        address: profileData.address || 'Unknown',
        business_phone: profileData.business_phone || null,
        business_email: profileData.business_email || null,
        delivery_radius: profileData.delivery_radius || 5.0,
        minimum_order_amount: profileData.minimum_order_amount || 0.0,
        delivery_fee: profileData.delivery_fee || 0.0,
        is_active: profileData.is_active ?? true,
        is_accepting_orders: profileData.is_accepting_orders ?? true,
        push_notifications_enabled: profileData.push_notifications_enabled ?? true,
        email_notifications_enabled: profileData.email_notifications_enabled ?? false,
      };

      const { data, error } = await supabase
        .from('vendor_profiles')
        .insert(payload)
        .select()
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error creating vendor profile:', error);
      return { data: null, error };
    }
  },

  // Find a vendor profile by matching the authenticated user's email or phone
  async findVendorByContact(userId) {
    try {
      const { data: sessionData, error: sessErr } = await supabase.auth.getSession();
      if (sessErr) {
        console.warn('[vendorService] findVendorByContact - session error', sessErr);
      }
      const userEmail = sessionData?.session?.user?.email;
      const userPhone = sessionData?.session?.user?.phone;

      // Try by business email first
      if (userEmail) {
        const { data: byEmail, error: byEmailErr } = await supabase
          .from('vendor_profiles')
          .select(`
            *,
            users!id(id, email, full_name, phone),
            vendor_operating_hours(*)
          `)
          .ilike('business_email', userEmail)
          .maybeSingle();
        if (byEmailErr) console.warn('[vendorService] findVendorByContact email lookup failed', byEmailErr);
        if (byEmail) return { data: byEmail, error: null };
      }

      // Try by phone (normalized)
      if (userPhone) {
        const normalizedPhone = userPhone.replace(/[^0-9]/g, '');
        const { data: byPhone, error: byPhoneErr } = await supabase
          .from('vendor_profiles')
          .select(`
            *,
            users!id(id, email, full_name, phone),
            vendor_operating_hours(*)
          `)
          .filter('business_phone', 'ilike', `%${normalizedPhone}%`)
          .maybeSingle();
        if (byPhoneErr) console.warn('[vendorService] findVendorByContact phone lookup failed', byPhoneErr);
        if (byPhone) return { data: byPhone, error: null };
      }

      return { data: null, error: null };
    } catch (error) {
      console.error('[vendorService] findVendorByContact error', error);
      return { data: null, error };
    }
  },

  // Get vendor dashboard analytics
  async getVendorAnalytics(vendorId, period = 'today') {
    try {
      let dateFilter;
      const now = new Date();
      
      switch (period) {
        case 'today':
          const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          dateFilter = today.toISOString();
          break;
        case 'week':
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          dateFilter = weekAgo.toISOString();
          break;
        case 'month':
          const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          dateFilter = monthAgo.toISOString();
          break;
      }

      // Get order statistics
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('*')
        .eq('vendor_id', vendorId)
        .gte('created_at', dateFilter);

      if (ordersError) throw ordersError;

      // Calculate analytics
      const totalOrders = orders.length;
      const totalRevenue = orders.reduce((sum, order) => sum + parseFloat(order.total_amount), 0);
      const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
      
      // Get unique customers for today
      const uniqueCustomers = new Set(orders.map(order => order.customer_id)).size;

      // Get status breakdown
      const statusBreakdown = orders.reduce((acc, order) => {
        acc[order.status] = (acc[order.status] || 0) + 1;
        return acc;
      }, {});

      return {
        data: {
          totalOrders,
          totalRevenue,
          avgOrderValue,
          newCustomers: uniqueCustomers,
          statusBreakdown,
          orders: orders.slice(0, 5) // Recent 5 orders
        },
        error: null
      };
    } catch (error) {
      console.error('Error fetching vendor analytics:', error);
      return { data: null, error };
    }
  },

  // Get vendor orders with pagination (two-step fetch to avoid nested-select RLS issues)
  async getVendorOrders(vendorId, { page = 1, limit = 20, status = null } = {}) {
    try {
      if (!vendorId) return { data: [], error: null };

      // 1) Fetch minimal order rows first
      let ordersQuery = supabase
        .from('orders')
        .select('id, order_number, customer_id, status, subtotal, delivery_fee, total_amount, special_instructions, delivery_address, created_at')
        .eq('vendor_id', vendorId)
        .order('created_at', { ascending: false })
        .range((page - 1) * limit, page * limit - 1);

      if (status) ordersQuery = ordersQuery.eq('status', status);

      const { data: orders, error: ordersErr } = await ordersQuery;
      if (ordersErr) {
        console.error('Error fetching vendor orders (minimal):', ordersErr);
        return { data: null, error: ordersErr };
      }

      // Debug: surface the authenticated session user id used for RLS checks
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const sessionUserId = sessionData?.session?.user?.id;
        console.debug('[vendorService] sessionUserId for getVendorOrders', { sessionUserId, vendorId });
      } catch (sessErr) {
        console.warn('[vendorService] failed to read session for debug', sessErr);
      }

      try { console.debug('[vendorService] getVendorOrders - orders fetched', { vendorId, count: (orders || []).length }); } catch (e) {}

      if (!orders || orders.length === 0) return { data: [], error: null };

      const customerIds = [...new Set(orders.map(o => o.customer_id).filter(Boolean))];
      const orderIds = orders.map(o => o.id);

      // 2) Fetch customer info separately (may be restricted by users RLS; see policies)
      let customers = [];
      if (customerIds.length > 0) {
        const { data: cData, error: cErr } = await supabase
          .from('users')
          .select('id, full_name, phone')
          .in('id', customerIds);
        if (cErr) {
          console.warn('[vendorService] getVendorOrders - users fetch failed', cErr);
        } else {
          customers = cData || [];
        }
      }

      // 3) Fetch order items and menu items for these orders
      let itemsByOrder = {};
      if (orderIds.length > 0) {
        const { data: itemsData, error: itemsErr } = await supabase
          .from('order_items')
          .select('*, menu_items(name, price)')
          .in('order_id', orderIds);

        if (itemsErr) {
          console.warn('[vendorService] getVendorOrders - order_items fetch failed', itemsErr);
        } else {
          (itemsData || []).forEach(it => {
            itemsByOrder[it.order_id] = itemsByOrder[it.order_id] || [];
            itemsByOrder[it.order_id].push(it);
          });
        }
      }

      // Merge data into enriched order objects
      const enriched = orders.map(o => ({
        ...o,
        users: customers.find(c => c.id === o.customer_id) || null,
        order_items: itemsByOrder[o.id] || [],
      }));

      try { console.debug('[vendorService] getVendorOrders - enriched orders', { vendorId, count: enriched.length }); } catch (e) {}
      return { data: enriched, error: null };
    } catch (error) {
      console.error('Error fetching vendor orders:', error);
      return { data: null, error };
    }
  },

  // Update order status
  async updateOrderStatus(orderId, newStatus, vendorId) {
    try {
      // First verify the order belongs to this vendor
      const { data: order, error: fetchError } = await supabase
        .from('orders')
        .select('vendor_id')
        .eq('id', orderId)
        .single();

      if (fetchError) throw fetchError;
      if (order.vendor_id !== vendorId) {
        throw new Error('Unauthorized: Order does not belong to this vendor');
      }

      // Update the order status
      const { data, error } = await supabase
        .from('orders')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId)
        .select()
        .single();

      if (error) throw error;

      // Status history will be recorded by the database trigger using auth.uid().

      return { data, error: null };
    } catch (error) {
      console.error('Error updating order status:', error);
      return { data: null, error };
    }
  },

  // Get vendor menu items
  async getVendorMenu(vendorId, { categoryId = null, includeInactive = false } = {}) {
    try {
      let query = supabase
        .from('menu_items')
        .select(`
          *,
          menu_categories(name, sort_order)
        `)
        .eq('vendor_id', vendorId)
        .order('sort_order', { ascending: true });

      if (categoryId) {
        query = query.eq('category_id', categoryId);
      }

      if (!includeInactive) {
        query = query.eq('is_available', true);
      }

      const { data, error } = await query;

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error fetching vendor menu:', error);
      return { data: null, error };
    }
  },

  // Get menu categories for vendor
  async getMenuCategories(vendorId) {
    try {
      const { data, error } = await supabase
        .from('menu_categories')
        .select('*')
        .eq('vendor_id', vendorId)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error fetching menu categories:', error);
      return { data: null, error };
    }
  },

  // Add/Update menu category
  async saveMenuCategory(vendorId, categoryData, categoryId = null) {
    try {
      const payload = { ...categoryData, vendor_id: vendorId };
      let result;
      if (categoryId) {
        // Update
        const { data, error } = await supabase
          .from('menu_categories')
          .update(payload)
          .eq('id', categoryId)
          .eq('vendor_id', vendorId)
          .select()
          .single();
        result = { data, error };
      } else {
        // Create
        const { data, error } = await supabase
          .from('menu_categories')
          .insert(payload)
          .select()
          .single();
        result = { data, error };
      }
      if (result.error) throw result.error;
      return { data: result.data, error: null };
    } catch (error) {
      console.error('Error saving menu category:', error);
      return { data: null, error };
    }
  },

  // Delete menu category
  async deleteMenuCategory(vendorId, categoryId) {
    try {
      // TODO: Check if any menu items are using this category first
      const { data, error } = await supabase
        .from('menu_categories')
        .delete()
        .eq('id', categoryId)
        .eq('vendor_id', vendorId);
      
      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error deleting menu category:', error);
      return { data: null, error };
    }
  },

  // Add/Update menu item
  async saveMenuItem(vendorId, itemData, itemId = null) {
    try {
      const itemPayload = {
        ...itemData,
        vendor_id: vendorId,
        updated_at: new Date().toISOString()
      };

      let result;
      if (itemId) {
        // Update existing item
        const { data, error } = await supabase
          .from('menu_items')
          .update(itemPayload)
          .eq('id', itemId)
          .eq('vendor_id', vendorId) // Ensure vendor owns this item
          .select()
          .single();
        
        result = { data, error };
      } else {
        // Create new item
        itemPayload.created_at = new Date().toISOString();
        const { data, error } = await supabase
          .from('menu_items')
          .insert(itemPayload)
          .select()
          .single();
        
        result = { data, error };
      }

      if (result.error) throw result.error;
      return { data: result.data, error: null };
    } catch (error) {
      console.error('Error saving menu item:', error);
      return { data: null, error };
    }
  },

  // Delete menu item
  async deleteMenuItem(vendorId, itemId) {
    try {
      const { data, error } = await supabase
        .from('menu_items')
        .delete()
        .eq('id', itemId)
        .eq('vendor_id', vendorId) // Ensure vendor owns this item
        .select()
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error deleting menu item:', error);
      return { data: null, error };
    }
  },

  // Get vendor settings/profile for editing
  async getVendorSettings(vendorId) {
    try {
      const { data, error } = await supabase
        .from('vendor_profiles')
        .select(`
          *,
          vendor_operating_hours(*),
          users(email, full_name, phone)
        `)
        .eq('id', vendorId)
        .maybeSingle();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error fetching vendor settings:', error);
      return { data: null, error };
    }
  },

  // Update vendor profile
  async updateVendorProfile(vendorId, profileData) {
    try {
      const { data, error } = await supabase
        .from('vendor_profiles')
        .update({
          ...profileData,
          updated_at: new Date().toISOString()
        })
        .eq('id', vendorId)
        .select()
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error updating vendor profile:', error);
      return { data: null, error };
    }
  },

  // Update operating hours for a specific day
  async updateOperatingHours(vendorId, dayOfWeek, hoursData) {
    try {
      const { data, error } = await supabase
        .from('vendor_operating_hours')
        .upsert({
          vendor_id: vendorId,
          day_of_week: dayOfWeek,
          is_open: hoursData.isOpen,
          open_time: hoursData.open || null,
          close_time: hoursData.close || null
        }, {
          onConflict: 'vendor_id,day_of_week'
        })
        .select()
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error updating operating hours:', error);
      return { data: null, error };
    }
  }
};

export default vendorService;
