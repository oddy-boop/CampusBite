
-- Add notification preference columns to vendor_profiles
ALTER TABLE public.vendor_profiles 
ADD COLUMN IF NOT EXISTS push_notifications_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS email_notifications_enabled BOOLEAN DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN public.vendor_profiles.push_notifications_enabled IS 'Whether vendor wants to receive push notifications for new orders, updates, etc.';
COMMENT ON COLUMN public.vendor_profiles.email_notifications_enabled IS 'Whether vendor wants to receive email notifications for orders and updates';
