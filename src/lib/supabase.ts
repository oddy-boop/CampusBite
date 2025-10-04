import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Enable automatic session refresh
    autoRefreshToken: true,
    // Persist session in AsyncStorage
    persistSession: true,
    // Detect session from URL (useful for OAuth)
    detectSessionInUrl: false,
  },
});

// Database types (you can generate these with supabase gen types typescript)
export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          phone: string | null;
          role: 'student' | 'vendor' | 'admin';
          student_id: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name: string;
          phone?: string | null;
          role?: 'student' | 'vendor' | 'admin';
          student_id?: string | null;
          avatar_url?: string | null;
        };
        Update: {
          email?: string;
          full_name?: string;
          phone?: string | null;
          role?: 'student' | 'vendor' | 'admin';
          student_id?: string | null;
          avatar_url?: string | null;
        };
      };
      vendor_profiles: {
        Row: {
          id: string;
          business_name: string;
          business_description: string | null;
          business_phone: string | null;
          business_email: string | null;
          business_license: string | null;
          address: string;
          delivery_radius: number;
          minimum_order_amount: number;
          delivery_fee: number;
          is_active: boolean;
          is_accepting_orders: boolean;
          rating: number;
          total_ratings: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          business_name: string;
          business_description?: string | null;
          business_phone?: string | null;
          business_email?: string | null;
          business_license?: string | null;
          address: string;
          delivery_radius?: number;
          minimum_order_amount?: number;
          delivery_fee?: number;
          is_active?: boolean;
          is_accepting_orders?: boolean;
          rating?: number;
          total_ratings?: number;
        };
        Update: {
          business_name?: string;
          business_description?: string | null;
          business_phone?: string | null;
          business_email?: string | null;
          business_license?: string | null;
          address?: string;
          delivery_radius?: number;
          minimum_order_amount?: number;
          delivery_fee?: number;
          is_active?: boolean;
          is_accepting_orders?: boolean;
        };
      };
      menu_items: {
        Row: {
          id: string;
          vendor_id: string;
          category_id: string | null;
          name: string;
          description: string | null;
          price: number;
          image_url: string | null;
          ingredients: string[] | null;
          preparation_time: number;
          is_available: boolean;
          is_featured: boolean;
          sort_order: number;
          allergens: string[] | null;
          nutritional_info: any | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          vendor_id: string;
          category_id?: string | null;
          name: string;
          description?: string | null;
          price: number;
          image_url?: string | null;
          ingredients?: string[] | null;
          preparation_time?: number;
          is_available?: boolean;
          is_featured?: boolean;
          sort_order?: number;
          allergens?: string[] | null;
          nutritional_info?: any | null;
        };
        Update: {
          category_id?: string | null;
          name?: string;
          description?: string | null;
          price?: number;
          image_url?: string | null;
          ingredients?: string[] | null;
          preparation_time?: number;
          is_available?: boolean;
          is_featured?: boolean;
          sort_order?: number;
          allergens?: string[] | null;
          nutritional_info?: any | null;
        };
      };
      orders: {
        Row: {
          id: string;
          order_number: string;
          customer_id: string;
          vendor_id: string;
          delivery_address_id: string | null;
          status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'out_for_delivery' | 'delivered' | 'cancelled';
          subtotal: number;
          delivery_fee: number;
          tax_amount: number;
          total_amount: number;
          payment_method: 'cash' | 'mobile_money' | 'card' | null;
          payment_status: 'pending' | 'paid' | 'failed' | 'refunded';
          special_instructions: string | null;
          estimated_delivery_time: string | null;
          confirmed_at: string | null;
          prepared_at: string | null;
          delivered_at: string | null;
          cancelled_at: string | null;
          cancellation_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          customer_id: string;
          vendor_id: string;
          delivery_address_id?: string | null;
          status?: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'out_for_delivery' | 'delivered' | 'cancelled';
          subtotal: number;
          delivery_fee?: number;
          tax_amount?: number;
          total_amount: number;
          payment_method?: 'cash' | 'mobile_money' | 'card' | null;
          payment_status?: 'pending' | 'paid' | 'failed' | 'refunded';
          special_instructions?: string | null;
          estimated_delivery_time?: string | null;
        };
        Update: {
          status?: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'out_for_delivery' | 'delivered' | 'cancelled';
          payment_status?: 'pending' | 'paid' | 'failed' | 'refunded';
          confirmed_at?: string | null;
          prepared_at?: string | null;
          delivered_at?: string | null;
          cancelled_at?: string | null;
          cancellation_reason?: string | null;
        };
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          menu_item_id: string;
          quantity: number;
          unit_price: number;
          total_price: number;
          special_instructions: string | null;
          created_at: string;
        };
        Insert: {
          order_id: string;
          menu_item_id: string;
          quantity: number;
          unit_price: number;
          total_price: number;
          special_instructions?: string | null;
        };
        Update: {
          quantity?: number;
          unit_price?: number;
          total_price?: number;
          special_instructions?: string | null;
        };
      };
    };
  };
};