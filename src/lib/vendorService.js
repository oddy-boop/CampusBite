// Vendor-specific Supabase operations
import { supabase } from '@/lib/supabase';

export const vendorService = {
  // Get vendor profile and basic info
  async getVendorProfile(userId) {
    try {
      const { data, error } = await supabase
        .from('vendor_profiles')
        .select(`
          *,
          users!id(id, email, full_name, phone)
        `)
        .eq('id', userId)
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error fetching vendor profile:', error);
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

  // Get vendor orders with pagination
  async getVendorOrders(vendorId, { page = 1, limit = 20, status = null } = {}) {
    try {
      let query = supabase
        .from('orders')
        .select(`
          *,
          users!inner(full_name, phone),
          order_items(
            *,
            menu_items(name, price)
          )
        `)
        .eq('vendor_id', vendorId)
        .order('created_at', { ascending: false })
        .range((page - 1) * limit, page * limit - 1);

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;

      if (error) throw error;
      return { data, error: null };
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

      // Add to status history
      await supabase
        .from('order_status_history')
        .insert({
          order_id: orderId,
          status: newStatus,
          changed_by: vendorId,
          changed_at: new Date().toISOString()
        });

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
          users!inner(email, full_name, phone)
        `)
        .eq('id', vendorId)
        .single();

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
