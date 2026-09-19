/**
 * POST /api/lead — called by src/worker.js.
 *
 * Validates a contact-form submission, checks the Turnstile token, and emails
 * the lead on via Resend. No server, no database: the lead lands in an inbox.
 *
 * Environment variables (Worker → Settings → Variables and Secrets, as Secrets):
 *   RESEND_API_KEY        required — https://resend.com/api-keys
 *   LEAD_TO               required — where leads go, comma-separated for several
 *   LEAD_FROM             required — e.g. "Bou site <website@yourdomain.com>",
 *                                    on a domain verified in Resend
 *   TURNSTILE_SECRET_KEY  optional — set it once the form renders a widget
 *
 * For local runs (`npm run dev`) put the same keys in .dev.vars.
 */

const MAX = { name: 120, email: 200, brand: 160, need: 80, message: 4000 };

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

const clean = (value, limit) => String(value ?? '').trim().slice(0, limit);

/* Deliberately loose: the only real test of an address is mail arriving at it. */
const looksLikeEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);

async function readBody(request) {
  const type = request.headers.get('content-type') || '';
  if (type.includes('application/json')) return await request.json();
  if (type.includes('form')) return Object.fromEntries(await request.formData());
  return {};
}

async function verifyTurnstile(token, secret, ip) {
  const body = new FormData();
  body.append('secret', secret);
  body.append('response', token || '');
  if (ip) body.append('remoteip', ip);

  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body,
  });
  const data = await res.json();
  return data.success === true;
}

export async function handleLead(request, env) {
  let payload;
  try {
    payload = await readBody(request);
  } catch {
    return json({ ok: false, error: 'Could not read that submission.' }, 400);
  }

  /* Honeypot: a real person never fills this in. Answer 200 so bots move on. */
  if (clean(payload.website, 200)) return json({ ok: true });

  const lead = {
    name: clean(payload.name, MAX.name),
    email: clean(payload.email, MAX.email),
    brand: clean(payload.brand, MAX.brand),
    need: clean(payload.need, MAX.need),
    message: clean(payload.message, MAX.message),
  };

  if (!lead.name || !looksLikeEmail(lead.email)) {
    return json({ ok: false, error: 'A name and a valid email are required.' }, 400);
  }

  if (env.TURNSTILE_SECRET_KEY) {
    const token = payload['cf-turnstile-response'];
    const ip = request.headers.get('CF-Connecting-IP');
    if (!(await verifyTurnstile(token, env.TURNSTILE_SECRET_KEY, ip))) {
      return json({ ok: false, error: 'Bot check failed. Reload the page and try again.' }, 400);
    }
  }

  if (!env.RESEND_API_KEY || !env.LEAD_TO || !env.LEAD_FROM) {
    console.error('lead: missing RESEND_API_KEY, LEAD_TO or LEAD_FROM');
    return json({ ok: false, error: 'The form is not configured yet.' }, 500);
  }

  const country = request.headers.get('CF-IPCountry') || 'unknown';
  const text = [
    `Name:    ${lead.name}`,
    `Email:   ${lead.email}`,
    `Brand:   ${lead.brand || '—'}`,
    `Needs:   ${lead.need || '—'}`,
    '',
    lead.message || '(no message)',
    '',
    '—',
    `Sent from the website contact form · ${new Date().toISOString()} · ${country}`,
  ].join('\n');

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      from: env.LEAD_FROM,
      to: env.LEAD_TO.split(',').map((address) => address.trim()),
      reply_to: lead.email,
      subject: `New lead — ${lead.name}${lead.brand ? ` (${lead.brand})` : ''}`,
      text,
    }),
  });

  if (!res.ok) {
    console.error('lead: resend responded', res.status, await res.text());
    return json({ ok: false, error: 'We could not send that just now.' }, 502);
  }

  return json({ ok: true });
}
