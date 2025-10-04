// Customer-specific Supabase operations
import { supabase } from '@/lib/supabase';

export const customerService = {
  // Get all active vendors with their details
  async getVendors({ searchQuery = '', category = null, isOpen = null } = {}) {
    try {
      let query = supabase
        .from('vendor_profiles')
        .select(`
          *,
          users!inner(id, full_name, email, phone)
        `)
        .eq('is_active', true)
        .order('rating', { ascending: false });

      // Apply filters
      if (searchQuery) {
        query = query.or(`business_name.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`);
      }

      if (category) {
        query = query.eq('cuisine_type', category);
      }

      if (isOpen !== null) {
        query = query.eq('is_active', isOpen);
      }

      const { data, error } = await query;

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error fetching vendors:', error);
      return { data: null, error };
    }
  },

  // Get a single vendor by ID with full details
  async getVendorById(vendorId) {
    try {
      const { data, error } = await supabase
        .from('vendor_profiles')
        .select(`
          *,
          users!inner(id, full_name, email,phone),
          vendor_operating_hours(*)
        `)
        .eq('id', vendorId)
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error fetching vendor:', error);
      return { data: null, error };
    }
  },

  // Get menu items for a specific vendor
  async getVendorMenu(vendorId, { categoryId = null } = {}) {
    try {
      let query = supabase
        .from('menu_items')
        .select(`
          *,
          menu_categories(id, name, sort_order)
        `)
        .eq('vendor_id', vendorId)
        .eq('is_available', true)
        .order('sort_order', { ascending: true });

      if (categoryId) {
        query = query.eq('category_id', categoryId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error fetching vendor menu:', error);
      return { data: null, error };
    }
  },

  // Get menu categories for a vendor
  async getVendorCategories(vendorId) {
    try {
      const { data, error } = await supabase
        .from('menu_categories')
        .select('*')
        .eq('vendor_id', vendorId)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error fetching categories:', error);
      return { data: null, error };
    }
  },

  // Create a new order
  async createOrder(orderData) {
    try {
      // Start a transaction by creating the order first
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          vendor_id: orderData.vendor_id,
          customer_id: orderData.customer_id,
          status: 'pending',
          total_amount: orderData.total_amount,
          delivery_address: orderData.delivery_address,
          delivery_fee: orderData.delivery_fee || 0,
          payment_method: orderData.payment_method,
          special_instructions: orderData.special_instructions || null,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order items
      const orderItems = orderData.items.map(item => ({
        order_id: order.id,
        menu_item_id: item.menu_item_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        subtotal: item.quantity * item.unit_price,
        special_instructions: item.special_instructions || null,
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) {
        // Rollback by deleting the order
        await supabase.from('orders').delete().eq('id', order.id);
        throw itemsError;
      }

      return { data: order, error: null };
    } catch (error) {
      console.error('Error creating order:', error);
      return { data: null, error };
    }
  },

  // Get customer's orders
  async getCustomerOrders(customerId, { status = null, limit = 20 } = {}) {
    try {
      let query = supabase
        .from('orders')
        .select(`
          *,
          vendor_profiles!inner(business_name, logo_url, business_phone),
          order_items(
            *,
            menu_items(name, price, image_url)
          )
        `)
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error fetching customer orders:', error);
      return { data: null, error };
    }
  },

  // Get a single order with full details
  async getOrderById(orderId, customerId) {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          vendor_profiles!inner(business_name, logo_url, business_phone, address),
          order_items(
            *,
            menu_items(name, price, description, image_url)
          ),
          order_status_history(*)
        `)
        .eq('id', orderId)
        .eq('customer_id', customerId)
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error fetching order:', error);
      return { data: null, error };
    }
  },

  // Cancel an order
  async cancelOrder(orderId, customerId) {
    try {
      // First verify the order belongs to the customer and can be cancelled
      const { data: order, error: fetchError } = await supabase
        .from('orders')
        .select('status')
        .eq('id', orderId)
        .eq('customer_id', customerId)
        .single();

      if (fetchError) throw fetchError;

      if (['delivered', 'cancelled'].includes(order.status)) {
        throw new Error('This order cannot be cancelled');
      }

      // Update order status
      const { data, error } = await supabase
        .from('orders')
        .update({ 
          status: 'cancelled',
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId)
        .eq('customer_id', customerId)
        .select()
        .single();

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      console.error('Error cancelling order:', error);
      return { data: null, error };
    }
  },

  // Submit a review for a vendor
  async submitReview(reviewData) {
    try {
      const { data, error } = await supabase
        .from('reviews')
        .insert({
          vendor_id: reviewData.vendor_id,
          customer_id: reviewData.customer_id,
          order_id: reviewData.order_id,
          rating: reviewData.rating,
          comment: reviewData.comment || null,
        })
        .select()
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error submitting review:', error);
      return { data: null, error };
    }
  },

  // Get reviews for a vendor
  async getVendorReviews(vendorId, { limit = 10 } = {}) {
    try {
      const { data, error } = await supabase
        .from('reviews')
        .select(`
          *,
          users!inner(full_name)
        `)
        .eq('vendor_id', vendorId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error fetching reviews:', error);
      return { data: null, error };
    }
  },
};

// Export individual functions for named imports
export const getVendors = customerService.getVendors;
export const getVendorById = customerService.getVendorById;
export const getVendorMenu = customerService.getVendorMenu;
export const getCategories = customerService.getCategories;
export const createOrder = customerService.createOrder;
export const getCustomerOrders = customerService.getCustomerOrders;
export const cancelOrder = customerService.cancelOrder;
export const submitReview = customerService.submitReview;
export const getVendorReviews = customerService.getVendorReviews;

export default customerService;
