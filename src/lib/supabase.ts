import { createClient } from '@supabase/supabase-js';
import toast from 'react-hot-toast';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Initialize Supabase client with better error handling
let supabaseInstance;

try {
  supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    },
    global: {
      headers: {
        'X-Client-Info': 'supabase-js-web'
      }
    }
  });
} catch (error) {
  console.error('Failed to initialize Supabase client:', error);
  toast.error('Failed to initialize database connection');
  throw error;
}

// Export initialized client
export const supabase = supabaseInstance;

// Helper function to check if Supabase is initialized
export const isSupabaseInitialized = () => {
  return !!supabaseInstance;
};