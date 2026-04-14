import { supabaseAdmin } from '@/integrations/supabase/client.server';

/**
 * Validate an API key from the Authorization header against user_settings.
 * Returns the user_id if valid, throws a Response otherwise.
 */
export async function authenticateApiKey(request: Request): Promise<string> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Response(JSON.stringify({ error: 'Missing or invalid Authorization header. Use: Bearer <api_key>' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const apiKey = authHeader.replace('Bearer ', '').trim();
  if (!apiKey) {
    throw new Response(JSON.stringify({ error: 'Empty API key' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { data, error } = await supabaseAdmin
    .from('user_settings')
    .select('user_id')
    .eq('api_key', apiKey)
    .maybeSingle();

  if (error || !data) {
    throw new Response(JSON.stringify({ error: 'Invalid API key' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return data.user_id;
}
