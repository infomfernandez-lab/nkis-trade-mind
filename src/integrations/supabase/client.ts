// Cliente Supabase apuntando al proyecto externo del usuario.
// NOTA: se sobreescriben las variables de entorno autogeneradas por Lovable Cloud
// porque la app debe leer/escribir en el proyecto Supabase propio del usuario.
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = 'https://rddewywrhtnddzbtozwy.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_YcIBPL9NCTuexuAqqCVCWA_GXNCWcZR';

function createSupabaseClient() {
  return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      storage: typeof window !== 'undefined' ? localStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}

let _supabase: ReturnType<typeof createSupabaseClient> | undefined;

export const supabase = new Proxy({} as ReturnType<typeof createSupabaseClient>, {
  get(_, prop, receiver) {
    if (!_supabase) _supabase = createSupabaseClient();
    return Reflect.get(_supabase, prop, receiver);
  },
});
