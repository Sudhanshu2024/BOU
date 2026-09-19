# Deploying — step by step

Everything below is free tier. You need three accounts: GitHub, Cloudflare (you
have one, your DNS is there) and Resend. No Vercel, no server, no database.

Order matters: Resend's domain check involves DNS propagation, so start it early.

---

## 1 · Put the code on GitHub

From this folder:

```bash
git init
git add .
git commit -m "Bunch of Us landing page"
```

Create an empty repo on github.com (no README, no .gitignore — this folder has
both), then:

```bash
git remote add origin git@github.com:<you>/<repo>.git
git branch -M main
git push -u origin main
```

`.gitignore` already keeps `node_modules/`, `.wrangler/` and `.dev.vars` out.
`.dev.vars` holds your local secrets — never commit it.

---

## 2 · Create the Cloudflare Pages project

1. dash.cloudflare.com → **Compute (Workers & Pages)** in the sidebar
2. **Create** → **Pages** tab → **Connect to Git**
3. Authorise GitHub, pick the repo, **Begin setup**
4. Build settings:
   - Framework preset: **None**
   - Build command: `npm run build`
   - Build output directory: `/`
5. **Save and Deploy**

The first build takes about a minute and gives you
`https://<project>.pages.dev`. The page will work; the form will not yet —
it has no keys.

`functions/api/lead.js` is picked up automatically and served at `/api/lead`.
Nothing to configure for it.

If the build fails on the Node version, add a variable `NODE_VERSION` = `20`
(step 5) and retry the deployment.

---

## 3 · Resend — where `RESEND_API_KEY`, `LEAD_FROM` and `LEAD_TO` come from

### 3a. Verify a sending domain

1. Sign up at resend.com
2. **Domains** → **Add Domain**
3. Enter a subdomain, e.g. `send.yourdomain.com` — a subdomain is Resend's
   recommendation and keeps your main domain's mail reputation separate
4. Resend shows three or four DNS records (an MX, an SPF TXT, a DKIM TXT,
   sometimes a DMARC TXT)
5. In another tab: Cloudflare dashboard → your domain → **DNS** → **Records** →
   **Add record** for each one. Copy name and value exactly. For any record
   Cloudflare offers to proxy, set it to **DNS only** (grey cloud)
6. Back in Resend, **Verify**. Usually a few minutes; can take up to an hour

Verified domain in hand, your `LEAD_FROM` is any address on it:

```
Bou site <website@send.yourdomain.com>
```

`LEAD_TO` is wherever you want leads to land — your normal inbox, no
verification needed. Several addresses: comma-separate them.

### 3b. Create the API key

1. Resend → **API Keys** → **Create API Key**
2. Name it `bou-landing`, permission **Sending access**, domain: the one above
3. Copy the key (`re_...`) **now** — Resend shows it once. If you lose it,
   delete the key and make another

---

## 4 · Turnstile — where the two anti-spam keys come from

1. Cloudflare dashboard → **Turnstile** → **Add widget**
2. Name: `bou-landing`. Hostnames: add `yourdomain.com`, `www.yourdomain.com`
   and `<project>.pages.dev` (so it works on preview deployments too)
3. Widget mode: **Managed**
4. **Create**. You get a **Site key** and a **Secret key**

Then:

- **Site key** → paste into `content.json` at `contact.form.turnstileSiteKey`,
  run `npm run build`, commit and push. It is public; it belongs in the repo
- **Secret key** → goes in Cloudflare as `TURNSTILE_SECRET_KEY` (next step).
  Never commit this one

Skip this section if you want to launch without Turnstile — the honeypot field
still runs, and the form works with the site key left empty. You can add it any
time.

---

## 5 · Add the variables in Cloudflare

Pages project → **Settings** → **Variables and secrets** → **Add**.

For each one: choose type **Secret** (so it is encrypted and never shown again),
enter the name and value, **Save**.

| Name | Value | Where it came from |
|---|---|---|
| `RESEND_API_KEY` | `re_...` | step 3b |
| `LEAD_TO` | `you@yourdomain.com` | your inbox |
| `LEAD_FROM` | `Bou site <website@send.yourdomain.com>` | step 3a |
| `TURNSTILE_SECRET_KEY` | the secret key | step 4 |

Two things people trip on:

- There are **two environments**, Production and Preview. Add the variables to
  both, or the form works on the live site and fails on preview builds
- Variables apply to **new** deployments only. After adding them go to
  **Deployments** → latest → **Retry deployment**, or push any commit

Same thing from the CLI, if you prefer:

```bash
npx wrangler pages secret put RESEND_API_KEY --project-name=<project>
```

---

## 6 · Point the domain at it

1. Pages project → **Custom domains** → **Set up a domain**
2. Enter `yourdomain.com`, then repeat for `www.yourdomain.com`
3. Cloudflare creates the DNS records itself — your zone is already there
4. SSL is issued automatically, usually within a minute or two

---

## 7 · Test the form end to end

On the live domain, fill the form in and submit. Expected: the button greys out,
then the success line from `content.json` appears, and the lead is in `LEAD_TO`
within seconds. Hit reply — it goes to the person who filled the form in.

If something fails, the page shows the reason. To see the server side: Pages
project → the deployment → **Functions** → **Real-time logs**, and submit again.

| What you see | What it means |
|---|---|
| "The form is not configured yet." | A variable is missing, or you have not redeployed since adding them |
| "Bot check failed." | The site key in `content.json` and `TURNSTILE_SECRET_KEY` are from different widgets |
| "We could not send that just now." | Resend rejected it — nearly always `LEAD_FROM` on an unverified domain. The log line has Resend's own message |
| Nothing happens at all | Open the browser console; check the form posts to `/api/lead` |

---

## Testing locally before any of this

```bash
npm run build && python3 -m http.server 8000     # page only, form will 404
```

To exercise the form on your machine you need the Functions runtime:

```bash
cat > .dev.vars <<'EOF'
RESEND_API_KEY="re_..."
LEAD_TO="you@yourdomain.com"
LEAD_FROM="Bou site <website@send.yourdomain.com>"
EOF

npm run build && npx wrangler pages dev .
```

`.dev.vars` is git-ignored. Leave `TURNSTILE_SECRET_KEY` out of it and the
function skips the bot check locally.

---

## Day to day, after launch

Edit `content.json` → `npm run build` → commit → push. Cloudflare rebuilds and
publishes in under a minute. Every build prints the placeholders still left;
`npm run build:strict` fails instead of warning, if you want that as a guard.
