import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const isBrowser = typeof window !== 'undefined';

if (isBrowser) {
  console.log('Supabase client initialized in browser. URL:', supabaseUrl, 'Anon key exists:', !!supabaseAnonKey);
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: isBrowser,
    autoRefreshToken: isBrowser,
    detectSessionInUrl: isBrowser,
    storageKey: 'firplak-auth-token',
    flowType: 'pkce',
    lock: isBrowser ? async (_name, _acquireTimeout, fn) => {
      // Evitar bloqueos y timeouts del Navigator LockManager en desarrollo y refresco rápido (HMR)
      return await fn();
    } : undefined
  }
});
