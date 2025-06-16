import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Create a conditional client that handles missing environment variables during build
export const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

// Helper function to ensure client is available
export function getSupabaseClient() {
  if (!supabase) {
    throw new Error('Supabase client not initialized. Please check your environment variables.')
  }
  return supabase
}