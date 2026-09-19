# Bunch of Us — landing page

Static landing page built from the Bou canvas in Claude Design
(https://claude.ai/artifact/SEKKDneKZKHbLMg4VpX4yt), following the `Main.dc.html`
(desktop 1440) and `Mobile.dc.html` (390) artboards and the Bou design system.

No server, no database. The page is static files on Cloudflare Pages; the contact
form posts to one Pages Function that emails the lead on.

```
content.json          every word and image on the page — the only file to edit for copy
build.mjs             renders index.html from content.json
src/page.mjs          the markup template
index.html            GENERATED — do not edit by hand, it is overwritten on each build
assets/css/styles.css design tokens + all layout
assets/js/main.js     mobile menu, contact form submit
assets/img/*.jpg      photography from the canvas
functions/api/lead.js Cloudflare Pages Function: validates, anti-spam, emails via Resend
```

## Editing content

Change `content.json`, then:

```bash
npm run build          # regenerates index.html and lists remaining placeholders
npm run dev            # build, then serve on http://localhost:8000
npm run build:strict   # same build, but fails if any [PLACEHOLDER] is left
```

Conventions inside `content.json`:

- `\n` in a heading becomes a line break.
- `**double asterisks**` in `about.lede` become bold.
- Anything in `[SQUARE BRACKETS]` is a placeholder; every build prints what is left.
- Images live in `assets/img/`; each needs an `alt` line describing it for screen
  readers and for anyone whose images fail to load.

Nothing here needs Node modules — only Node 18+ to run the build.

### Later: a CMS UI

When someone other than a developer needs to edit copy, add Sveltia CMS or Decap
CMS at `/admin`. Both are git-based: they edit this same `content.json` through a
browser form and commit to GitHub, which triggers the Pages build. No extra
infrastructure, and nothing about the page changes.

## Deploying on Cloudflare Pages

**[DEPLOY.md](DEPLOY.md) is the click-by-click version** — accounts, keys, DNS,
variables, testing. The summary:

1. Push this folder to a GitHub repo.
2. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** → connect the repo.
3. Build settings:
   - Build command: `npm run build`
   - Build output directory: `/`
   - Node version: 18 or newer (`NODE_VERSION` variable if needed)
4. **Custom domains** → add your domain. DNS is already on Cloudflare, so the
   record is created for you.

`functions/` is picked up automatically — `functions/api/lead.js` is served at
`/api/lead`, which is what the form posts to.

## The lead form

Flow: browser → `POST /api/lead` (Pages Function) → Resend → your inbox.
The reply-to is set to the lead's address, so replying in your mail client
answers them directly.

### Environment variables

Pages → your project → **Settings** → **Variables and secrets**. Add these for
both Production and Preview, marked as secrets:

| Name | Required | Value |
|---|---|---|
| `RESEND_API_KEY` | yes | from https://resend.com/api-keys |
| `LEAD_TO` | yes | where leads land, e.g. `hello@yourdomain.com` (comma-separated for several) |
| `LEAD_FROM` | yes | e.g. `Bou site <website@yourdomain.com>` — the domain must be verified in Resend |
| `TURNSTILE_SECRET_KEY` | recommended | from the Turnstile widget you create |

Resend's free tier covers 3,000 emails a month, far past what a landing page
generates. Sending mail straight from a Worker is not an option any more —
MailChannels ended its free Workers route in 2024 — which is why this goes
through an email API.

### Spam

Two layers, both free:

- A honeypot field already in the form; anything that fills it gets a silent 200.
- Cloudflare Turnstile. Create a widget (dashboard → Turnstile), put the **site
  key** in `content.json` at `contact.form.turnstileSiteKey`, and the **secret
  key** in `TURNSTILE_SECRET_KEY`. The build then renders the widget and the
  Function starts verifying tokens. Leave the site key empty and the form works
  without it.

### Running it locally

```bash
npm install -g wrangler        # or npx
echo 'RESEND_API_KEY="re_..."' > .dev.vars
echo 'LEAD_TO="you@yourdomain.com"' >> .dev.vars
echo 'LEAD_FROM="Bou site <website@yourdomain.com>"' >> .dev.vars
npm run build && npx wrangler pages dev .
```

`.dev.vars` is git-ignored. `python3 -m http.server` serves the page but not the
Function, so use `wrangler pages dev` when testing the form.

### If you later want leads stored

Add a Cloudflare D1 database, bind it as `DB` in the Pages project, and insert a
row in `functions/api/lead.js` before the Resend call. Still free at this volume,
and worth doing only when you actually want to query or export leads.

## Before launch — replace every placeholder

`npm run build` prints the current list. As it stands:

- **Work** — the Offbeat result line, three client names, plus 3–6 more case studies
- **Testimonials** — all three quotes, names, roles, companies
- **Contact** — email, phone, city
- **Footer** — Instagram and LinkedIn URLs
- **Team photos** — `assets/img/team-*.jpg` are stand-ins from the canvas; swap in
  real portraits of Sudhanshu, Surbhie and Trisha
- **Form** — set the four environment variables above, or the endpoint returns
  "The form is not configured yet."

## Design system

Cobalt `#2952A1`, cream `#EBE2CD`, paper `#F6F2EA`, ink `#1A1A1A`, rust `#B5522E`.
Anton (display), Archivo (text), Lekton (mono), Tinos (wordmark), Allura
(signature), from Google Fonts. Square corners throughout; separation comes from
rules, never shadows. Bands alternate cream / cobalt / ink, each carrying the
grain overlay.
