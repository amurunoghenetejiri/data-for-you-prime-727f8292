// Verify DATA4ME OTP code against stored hash
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } },
);

async function sha256(text: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { email: rawEmail, code, purpose } = await req.json();
    const email = String(rawEmail || '').trim().toLowerCase();
    const codeStr = String(code || '').trim();
    if (!email || !/^\d{6}$/.test(codeStr)) {
      return new Response(JSON.stringify({ error: 'Email and 6-digit code required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: rows, error } = await admin
      .from('otp_codes')
      .select('*')
      .eq('email', email)
      .eq('purpose', purpose || 'signup')
      .is('used_at', null)
      .order('created_at', { ascending: false })
      .limit(1);
    if (error) throw error;
    const row = rows?.[0];
    if (!row) {
      return new Response(JSON.stringify({ error: 'No active code. Request a new one.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (new Date(row.expires_at).getTime() < Date.now()) {
      return new Response(JSON.stringify({ error: 'Code expired. Request a new one.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (row.attempts >= 5) {
      return new Response(JSON.stringify({ error: 'Too many attempts. Request a new code.' }), {
        status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const hash = await sha256(`${email}:${codeStr}`);
    if (hash !== row.code_hash) {
      await admin.from('otp_codes').update({ attempts: row.attempts + 1 }).eq('id', row.id);
      return new Response(JSON.stringify({ error: 'Incorrect code' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await admin.from('otp_codes').update({ used_at: new Date().toISOString() }).eq('id', row.id);

    // Best-effort: ensure the user's email is confirmed
    try {
      const { data: list } = await admin.auth.admin.listUsers();
      const u = list?.users?.find((x) => (x.email || '').toLowerCase() === email);
      if (u && !u.email_confirmed_at) {
        await admin.auth.admin.updateUserById(u.id, { email_confirm: true });
      }
    } catch { /* noop */ }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
