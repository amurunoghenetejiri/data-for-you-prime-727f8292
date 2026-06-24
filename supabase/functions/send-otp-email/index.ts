// DATA4ME branded OTP email — generates code, stores hash, emails via SMTP
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { SMTPClient } from 'npm:emailjs@4.0.3';

const SMTP_HOST = Deno.env.get('SMTP_HOST') || '';
const SMTP_PORT = Number(Deno.env.get('SMTP_PORT') || '465');
const SMTP_USER = Deno.env.get('SMTP_USER') || '';
const SMTP_PASSWORD = Deno.env.get('SMTP_PASSWORD') || '';
const FROM_EMAIL = Deno.env.get('SMTP_FROM_EMAIL') || SMTP_USER;
const FROM_NAME = Deno.env.get('SMTP_FROM_NAME') || 'DATA4ME';

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
    const body = await req.json().catch(() => ({}));
    const email = String(body.email || '').trim().toLowerCase();
    const purpose = String(body.purpose || 'signup');
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return new Response(JSON.stringify({ error: 'Valid email required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASSWORD) {
      return new Response(JSON.stringify({ error: 'SMTP not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Rate-limit: max 1 request / 30s per email
    const since = new Date(Date.now() - 30_000).toISOString();
    const { count } = await admin.from('otp_codes').select('id', { count: 'exact', head: true })
      .eq('email', email).gte('created_at', since);
    if ((count ?? 0) > 0) {
      return new Response(JSON.stringify({ error: 'Please wait before requesting another code' }), {
        status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const code_hash = await sha256(`${email}:${code}`);
    const expires_at = new Date(Date.now() + 10 * 60_000).toISOString();

    const { error: insErr } = await admin.from('otp_codes').insert({
      email, code_hash, purpose, expires_at,
    });
    if (insErr) throw insErr;

    const client = new SMTPClient({
      user: SMTP_USER, password: SMTP_PASSWORD, host: SMTP_HOST, port: SMTP_PORT,
      ssl: SMTP_PORT === 465, tls: SMTP_PORT !== 465,
    });

    const text = `DATA4ME Verification Code\n\nYour verification code is:\n\n${code}\n\nThis code expires in 10 minutes.\n\nIf you didn't request this, ignore this email.`;
    const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;background:#ffffff;padding:32px;color:#0f172a">
      <div style="max-width:480px;margin:auto;border:1px solid #e2e8f0;border-radius:16px;padding:32px;text-align:center">
        <h1 style="margin:0 0 8px;color:#7c3aed">DATA4ME</h1>
        <p style="color:#64748b;margin:0 0 24px">Verification Code</p>
        <div style="font-size:40px;letter-spacing:12px;font-weight:700;background:#f5f3ff;color:#5b21b6;padding:20px;border-radius:12px;margin:0 0 16px">${code}</div>
        <p style="color:#475569;font-size:14px;margin:0">This code expires in <b>10 minutes</b>.</p>
        <p style="color:#94a3b8;font-size:12px;margin:24px 0 0">If you didn't request this, ignore this email.</p>
      </div></body></html>`;

    await client.sendAsync({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: email,
      subject: `DATA4ME verification code: ${code}`,
      text,
      attachment: [{ data: html, alternative: true }],
    });

    // Best-effort log
    await admin.from('email_logs').insert({
      recipient: email, subject: 'DATA4ME verification code', status: 'sent', purpose,
    }).then(() => {}, () => {});

    return new Response(JSON.stringify({ success: true, expires_at }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
