import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

async function removeUserFiles(admin: any, userId: string) {
  const { data: buckets, error: bucketsError } = await admin.storage.listBuckets();
  if (bucketsError) throw bucketsError;
  for (const bucket of buckets || []) {
    const storage = admin.storage.from(bucket.id);
    const walk = async (prefix: string, depth: number): Promise<void> => {
      if (depth > 8) throw new Error('Storage folder nesting is too deep to safely delete.');
      let offset = 0;
      while (true) {
        const { data, error } = await storage.list(prefix, { limit: 1000, offset });
        if (error) throw error;
        const files: string[] = [];
        for (const entry of data || []) {
          const path = prefix + '/' + entry.name;
          if (entry.id == null) await walk(path, depth + 1);
          else files.push(path);
        }
        if (files.length) {
          const { error: removeError } = await storage.remove(files);
          if (removeError) throw removeError;
        }
        if ((data || []).length < 1000) break;
        offset += 1000;
      }
    };
    await walk(userId, 0);
  }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed.' }, { status: 405, headers: corsHeaders });
  }

  const authorization = request.headers.get('Authorization') || '';
  if (!authorization.startsWith('Bearer ')) {
    return Response.json({ error: 'Sign in again before deleting your account.' }, { status: 401, headers: corsHeaders });
  }

  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anonKey || !serviceKey) {
    return Response.json({ error: 'Account deletion is not configured on the server.' }, { status: 500, headers: corsHeaders });
  }

  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) {
    return Response.json({ error: 'Your session is no longer valid. Sign in again.' }, { status: 401, headers: corsHeaders });
  }

  const { error: dataError } = await userClient.rpc('delete_my_account_data');
  if (dataError) {
    console.error('delete-account data removal failed', dataError.message);
    return Response.json({ error: 'We could not remove the account data. Apply the privacy migration, then try again.' }, { status: 500, headers: corsHeaders });
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  try {
    await removeUserFiles(admin, user.id);
  } catch (error) {
    console.error('delete-account storage cleanup failed', error instanceof Error ? error.message : 'unknown error');
    return Response.json({ error: 'Account records were removed, but stored files still need cleanup. Contact support before retrying account deletion.' }, { status: 500, headers: corsHeaders });
  }
  const { error: deleteAuthError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteAuthError) {
    console.error('delete-account failed for auth user', deleteAuthError.message);
    return Response.json({ error: 'Fitness data was removed, but the login could not be deleted. Contact support before retrying.' }, { status: 500, headers: corsHeaders });
  }
  return Response.json({ success: true }, { status: 200, headers: corsHeaders });
});
