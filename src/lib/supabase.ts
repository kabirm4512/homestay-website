import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

/**
 * Checks whether valid Supabase credentials have been configured in the environment.
 */
export const isSupabaseConfigured = (): boolean => {
  return Boolean(
    supabaseUrl &&
    supabaseAnonKey &&
    supabaseUrl.startsWith('https://') &&
    !supabaseUrl.includes('your-project') &&
    supabaseAnonKey.length > 20
  );
};

/**
 * Supabase client instance for public client-side and server-side calls.
 * If credentials are not yet supplied, a mock-safe dummy client is initialized
 * so the application never crashes during build or initial setup.
 */
export const supabase = isSupabaseConfigured()
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : createClient(
      'https://placeholder-zero-cost.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder-zero-cost-anon-token',
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

/**
 * Supabase client with Service Role privileges (server-side only, for admin actions).
 */
export const getSupabaseAdmin = () => {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey;
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
    },
  });
};
