// DATA4ME branded OTP email via SMTP (e.g. Gmail)
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { SMTPClient } from 'npm:emailjs@4.0.3';

const SMTP_HOST = Deno.env.get('SMTP_HOST') || '';
const SMTP_PORT = Number(Deno.env.get('SMTP_PORT') || '465');
const SMTP_USER = Deno.env.get('SMTP_USER') || '';
const SMTP_PASSWORD = Deno.env.get('SMTP_PASSWORD') || '';
const FROM_EMAIL = Deno.env.get('SMTP_FROM_EMAIL') || SMTP_USER;
const FROM_NAME = Deno.env.get('SMTP_FROM_NAME') || 'DATA4ME';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { email, code } = await req.json();
    if (!email || !code || String(code).length !== 6) {
      return new Response(JSON.stringify({ error: 'email and 6-digit code required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASSWORD) {
      return new Response(JSON.stringify({ error: 'SMTP not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const client = new SMTPClient({
      user: SMTP_USER,
      password: SMTP_PASSWORD,
      host: SMTP_HOST,
      port: SMTP_PORT,
      ssl: SMTP_PORT === 465,
      tls: SMTP_PORT !== 465,
    });

    const text = `DATA4ME Verification Code\n\nYour verification code is:\n\n${code}\n\nThis code expires in 10 minutes.`;
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

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
