// Cliente Supabase secundario, usado SOLO por la pestaña Activos para leer
// la tabla `assets` del proyecto externo del usuario. No afecta al cliente
// principal de la app (src/integrations/supabase/client.ts).
import { createClient } from '@supabase/supabase-js';

const ASSETS_SUPABASE_URL = 'https://rddewywrhtnddzbtozwy.supabase.co';
const ASSETS_SUPABASE_ANON_KEY = 'sb_publishable_YcIBPL9NCTuexuAqqCVCWA_GXNCWcZR';

export const assetsSupabase = createClient(ASSETS_SUPABASE_URL, ASSETS_SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});
