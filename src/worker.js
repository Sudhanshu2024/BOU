/**
 * The Worker in front of the static site.
 *
 * Anything that matches a file in dist/ is served by Cloudflare's asset layer
 * and never reaches this code. Everything else lands here: /api/lead is the
 * contact form, and the rest falls back to the assets (so a bad URL gets the
 * normal 404 rather than a bare string).
 */

import { handleLead } from './lead.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/lead') {
      if (request.method !== 'POST') {
        return new Response(JSON.stringify({ ok: false, error: 'Method not allowed.' }), {
          status: 405,
          headers: { 'content-type': 'application/json; charset=utf-8', allow: 'POST' },
        });
      }
      return handleLead(request, env);
    }

    return env.ASSETS.fetch(request);
  },
};
