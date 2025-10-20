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


  // Create a new order
  async createOrder(orderData) {
    try {
      // Ensure we use the currently authenticated user's id from Supabase session
      const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
      if (sessionErr) throw sessionErr;
      const customerId = sessionData?.session?.user?.id;
      if (!customerId) throw new Error('Authentication required to create an order');

      // Compute subtotal from provided items if not explicitly set
      const items = Array.isArray(orderData.items) ? orderData.items : [];
      const subtotal = items.reduce((sum, it) => {
        const unit = Number(it.unit_price ?? it.price ?? 0) || 0;
        return sum + unit * (Number(it.quantity) || 0);
      }, 0);

      // Insert order record (subtotal is required by schema)
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          vendor_id: orderData.vendor_id,
          customer_id: customerId,
          status: 'pending',
          subtotal: subtotal,
          delivery_fee: orderData.delivery_fee || 0,
          tax_amount: orderData.tax_amount || 0,
          total_amount: orderData.total_amount,
          payment_method: orderData.payment_method,
          special_instructions: orderData.special_instructions || null,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Prepare order_items payload using correct column names
      const orderItemsPayload = items.map(item => ({
        order_id: order.id,
        menu_item_id: item.menu_item_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: (Number(item.unit_price) || Number(item.price) || 0) * (Number(item.quantity) || 0),
        special_instructions: item.special_instructions || null,
      }));

      const { data: insertedItems, error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItemsPayload)
        .select();

      if (itemsError) {
        // Rollback by deleting the order if items insertion failed
        try { await supabase.from('orders').delete().eq('id', order.id); } catch (e) {}
        throw itemsError;
      }

      // Return a full order record (including nested items and vendor) for immediate display
      const fullOrder = await supabase
        .from('orders')
        .select(`
          *,
          vendor_profiles(business_name, logo_url, business_phone),
          order_items(*, menu_items(name, price, image_url)),
          order_status_history(*)
        `)
        .eq('id', order.id)
        .eq('customer_id', customerId)
        .single();

      try { console.debug('[customerService] createOrder:', { orderId: order.id, customerId, insertedItemsCount: (insertedItems || []).length }); } catch (e) {}

      if (fullOrder.error) throw fullOrder.error;
      return { data: fullOrder.data, error: null };
    } catch (error) {
      console.error('Error creating order:', error);
      return { data: null, error };
    }
  },

  // Get customer's orders
  // Get customer's orders (two-step: fetch orders first, then load related rows separately)
  async getCustomerOrders(customerId, { status = null, limit = 20 } = {}) {
    try {
      // If caller didn't provide a customerId, or provided one that doesn't match the
      // currently authenticated session, try to derive the effective customer id
      // from the active Supabase session. This avoids cases where local auth state
      // and the active session diverge.
      let effectiveCustomerId = customerId;
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const sessionUserId = sessionData?.session?.user?.id;
        try { console.debug('[customerService] getCustomerOrders - sessionUserId vs passed customerId', { sessionUserId, passedCustomerId: customerId }); } catch (_) {}
        if (!effectiveCustomerId) effectiveCustomerId = sessionUserId;
      } catch (sessErr) {
        try { console.warn('[customerService] getCustomerOrders - failed to read session', sessErr); } catch (_) {}
      }

      if (!effectiveCustomerId) return { data: [], error: null };

      // 1) Fetch top-level order rows (minimal payload) to avoid nested-select RLS interactions
      let ordersQuery = supabase
        .from('orders')
        .select('id, order_number, customer_id, vendor_id, status, subtotal, delivery_fee, total_amount, special_instructions, created_at')
        .eq('customer_id', effectiveCustomerId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (status) ordersQuery = ordersQuery.eq('status', status);

      const { data: orders, error: ordersErr } = await ordersQuery;
      if (ordersErr) {
        console.error('[customerService] getCustomerOrders - failed to fetch orders:', ordersErr);
        return { data: null, error: ordersErr };
      }

      try { console.debug('[customerService] getCustomerOrders - orders fetched', { customerId, count: (orders || []).length }); } catch (e) {}

      if (!orders || orders.length === 0) return { data: [], error: null };

      const vendorIds = [...new Set(orders.map(o => o.vendor_id).filter(Boolean))];
      const orderIds = orders.map(o => o.id);

      // 2) Fetch vendor profiles for involved vendors (separate query to avoid nested RLS issues)
      let vendorProfiles = [];
      if (vendorIds.length > 0) {
        const { data: vData, error: vErr } = await supabase
          .from('vendor_profiles')
          .select('id, business_name, logo_url, business_phone')
          .in('id', vendorIds);
        if (vErr) {
          console.warn('[customerService] getCustomerOrders - vendor_profiles fetch failed', vErr);
        } else {
          vendorProfiles = vData || [];
        }
      }

      // 3) Fetch order_items and attached menu_items for these orders
      let itemsByOrder = {};
      if (orderIds.length > 0) {
        try {
          const { data: itemsData, error: itemsErr } = await supabase
            .from('order_items')
            .select('*, menu_items(name, price, image_url)')
            .in('order_id', orderIds);

          if (itemsErr) {
            // If RLS prevents selecting order_items, log and continue with empty items
            console.warn('[customerService] getCustomerOrders - order_items fetch failed', itemsErr);
          } else {
            (itemsData || []).forEach(it => {
              itemsByOrder[it.order_id] = itemsByOrder[it.order_id] || [];
              itemsByOrder[it.order_id].push(it);
            });
          }
        } catch (fetchErr) {
          console.warn('[customerService] getCustomerOrders - order_items fetch exception', fetchErr);
        }
      }

      // Merge into enriched order objects
      const enriched = orders.map(o => ({
        ...o,
        vendor_profiles: vendorProfiles.find(v => v.id === o.vendor_id) || null,
        order_items: itemsByOrder[o.id] || [],
      }));

      try { console.debug('[customerService] getCustomerOrders - enriched orders', { customerId, count: enriched.length }); } catch (e) {}
      return { data: enriched, error: null };
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
          vendor_profiles(business_name, logo_url, business_phone, address),
          order_items(
            *,
            menu_items(name, price, description, image_url)
          ),
          order_status_history(*)
        `)
        .eq('id', orderId)
        .eq('customer_id', customerId)
        .single();

      try { console.debug('[customerService] getOrderById:', { orderId, hasData: !!data }); } catch (e) {}

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

      // Only allow customers to cancel orders that are still pending or confirmed.
      if (!['pending', 'confirmed'].includes(order.status)) {
        throw new Error('This order cannot be cancelled at this stage');
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
