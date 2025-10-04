# Database Migration: Add Notification Preferences

## Overview
This migration adds two new columns to the `vendor_profiles` table to store notification preferences:
- `push_notifications_enabled` (BOOLEAN, default: true)
- `email_notifications_enabled` (BOOLEAN, default: false)

## How to Run the Migration

### Option 1: Using Supabase Dashboard (Recommended)
1. Go to your Supabase project dashboard
2. Navigate to the **SQL Editor** section
3. Click **New Query**
4. Copy and paste the contents of `add_notification_preferences.sql`
5. Click **Run** to execute the migration

### Option 2: Using Supabase CLI
```bash
# Make sure you're in the mobile app directory
cd c:\Users\odoom\OneDrive\CampusBite\createxyz-project\_\apps\mobile

# Run the migration
supabase db push add_notification_preferences.sql
```

### Option 3: Direct SQL Execution
If you have direct database access, run:
```sql
ALTER TABLE public.vendor_profiles 
ADD COLUMN IF NOT EXISTS push_notifications_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS email_notifications_enabled BOOLEAN DEFAULT false;
```

## Verification
After running the migration, verify it worked by:

1. **Check the table structure:**
   ```sql
   SELECT column_name, data_type, column_default 
   FROM information_schema.columns 
   WHERE table_name = 'vendor_profiles' 
   AND column_name IN ('push_notifications_enabled', 'email_notifications_enabled');
   ```

2. **Test the feature:**
   - Open the vendor settings page in your app
   - Toggle the notification preferences
   - Navigate away and return to verify they persist

## What This Enables
After this migration:
- ✅ Push notification toggle will save to database
- ✅ Email notification toggle will save to database
- ✅ Settings will persist when navigating away
- ✅ Settings will load correctly on page reload
- ✅ Auto-save functionality for notification toggles

## Rollback (if needed)
If you need to undo this migration:
```sql
ALTER TABLE public.vendor_profiles 
DROP COLUMN IF EXISTS push_notifications_enabled,
DROP COLUMN IF EXISTS email_notifications_enabled;
```

## Files Updated
1. `add_notification_preferences.sql` - Migration file
2. `supabase-schema.sql` - Updated schema documentation
3. `src/app/vendor-settings.jsx` - Updated to load/save notification preferences
4. No changes needed to `vendorService.js` - it already handles dynamic fields
