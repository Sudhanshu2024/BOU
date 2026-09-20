# Deploying — step by step

Everything below is free tier. You need three accounts: GitHub, Cloudflare (you
have one, your DNS is there) and Resend. No Vercel, no server, no database.

The site is a Cloudflare **Worker with static assets**: `dist/` is served as
files, and `src/worker.js` handles the one dynamic route, `POST /api/lead`.

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

## 2 · Build settings for the Worker

Your project (`bou`) is a **Worker** connected to Git, so its build settings are
four fields. Cloudflare dashboard → **Compute (Workers & Pages)** → `bou` →
**Settings** → **Builds**:

| Field | Value | Why |
|---|---|---|
| Build command | `npm run build` | renders `dist/` from `content.json` |
| Deploy command | `npx wrangler deploy` | uploads `dist/` + the Worker |
| Version command | `npx wrangler versions upload` | preview builds on non-production branches |
| **Root directory** | `/` (leave it empty) | **not `dist`** |

Root directory means "which folder of the repo to build in", not where the
output goes. Pointing it at `dist` fails the build, because `dist/` is generated
and git-ignored — it does not exist when Cloudflare clones the repo.

Where the output goes is set in `wrangler.jsonc` instead:

```jsonc
"assets": { "directory": "./dist", "binding": "ASSETS" }
```

Production branch: `main`.

### How a request is handled

Static files in `dist/` are served by Cloudflare's asset layer and never run any
code. Only what does not match a file reaches `src/worker.js`, which answers
`POST /api/lead` and hands everything else back to the assets. That is why the
form endpoint needs no separate service.

If a build has already failed with the wrong root directory: fix the field,
**Save**, then **Deployments** → latest → **Retry deployment**.

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
   and `bou.<your-subdomain>.workers.dev` (so it works on preview deployments too)
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

Worker `bou` → **Settings** → **Variables and Secrets** → **Add**.

Set every one of them as type **Secret**, not Variable. A plaintext Variable
added in the dashboard is dropped by the next `wrangler deploy`, because the
deployment takes its variables from `wrangler.jsonc` — which declares none on
purpose. Secrets are stored separately and survive every deploy. If the
dashboard shows a yellow "keep deployments in sync" banner, it is telling you a
Variable is about to be lost: delete it and re-add it as a Secret.

For each one: choose type **Secret** (so it is encrypted and never shown again),
enter the name and value, **Save**.

| Name | Value | Where it came from |
|---|---|---|
| `RESEND_API_KEY` | `re_...` | step 3b |
| `LEAD_TO` | `you@yourdomain.com` | your inbox |
| `LEAD_FROM` | `website@send.yourdomain.com` — bare, no quotes | step 3a |
| `TURNSTILE_SECRET_KEY` | the secret key | step 4 |

Two things people trip on:

- Secrets apply to **new** deployments only. After adding them go to
  **Deployments** → latest → **Retry deployment**, or push any commit
- Set them as **Secret**, not plaintext, so they are encrypted and hidden after
  saving. Secrets set here survive every later deploy — `wrangler deploy` does
  not wipe them

Same thing from the CLI, if you prefer:

```bash
npx wrangler secret put RESEND_API_KEY
```

---

## 6 · Point the domain at it

1. Worker `bou` → **Domains** (or Settings → Domains & Routes) → **Add** →
   **Custom domain**
2. Enter `yourdomain.com`, then repeat for `www.yourdomain.com`
3. Cloudflare creates the DNS records itself — your zone is already there
4. SSL is issued automatically, usually within a minute or two

### "Hostname already has externally managed DNS records"

The zone already has an A, AAAA or CNAME record for that hostname, left over
from whatever the domain pointed at before, and Cloudflare will not overwrite a
record you manage.

Go to **bunchofus.in** → **DNS** → **Records** and delete the **A / AAAA /
CNAME** records named `bunchofus.in` (`@`) and `www` — note their values first
in case you want them back. Then add the domain again.

Delete nothing else. MX and TXT records carry your email; removing them breaks
inbound mail and the SPF/DKIM records that Resend needs. The `send.bunchofus.in`
records belong to Resend and must stay.

If the domain currently serves a live site you are not ready to replace, add the
Worker on a spare hostname instead (put `site` in the subdomain box) and move it
to the root at cut-over.

---

## 7 · Test the form end to end

On the live domain, fill the form in and submit. Expected: the button greys out,
then the success line from `content.json` appears, and the lead is in `LEAD_TO`
within seconds. Hit reply — it goes to the person who filled the form in.

If something fails, the page shows the reason. To see the server side: Worker
`bou` → **Observability** → **Logs** (live), and submit again.

| What you see | What it means |
|---|---|
| "The form is not configured yet." | A variable is missing, or you have not redeployed since adding them |
| "Bot check failed." | The site key in `content.json` and `TURNSTILE_SECRET_KEY` are from different widgets |
| "We could not send that just now." | Resend rejected it. See the table below |
| Nothing happens at all | Open the browser console; check the form posts to `/api/lead` |

### When Resend rejects the send

Worker `bou` → **Observability** → **Logs**, submit the form again, and read the
`lead: resend rejected` line — it carries Resend's own message, and the lead's
details so nothing is lost. Or reproduce it in one command:

```bash
curl -X POST https://api.resend.com/emails \
  -H "Authorization: Bearer re_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"from":"Bou site <website@send.bunchofus.in>","to":["you@bunchofus.in"],"subject":"test","text":"test"}'
```

| Resend says | Cause | Fix |
|---|---|---|
| `domain is not verified` | verification still pending | check the DNS records are in Cloudflare with the proxy **off** (grey cloud), then Verify again |
| `You can only send testing emails to your own email address` | no verified domain, so the account is in test mode | finish verification, or temporarily use `onboarding@resend.dev` as `LEAD_FROM` and your Resend signup address as `LEAD_TO` |
| `Invalid from address` / 403 | the `from` domain does not exactly match the verified one | verifying `bunchofus.in` does not authorise `send.bunchofus.in`, or the reverse. Make the two match |
| `Invalid \`from\` field` (422) | the secret's value is not a valid address — usually quotes pasted with it | set `LEAD_FROM` to the bare address, `website@send.bunchofus.in`, with no quotes, spaces or newline. `.dev.vars` needs the quotes; the dashboard field does not |

---

## Testing locally before any of this

```bash
npm run preview          # static page only on :8000, /api/lead will 404
```

To exercise the form on your machine you need the Workers runtime:

```bash
cat > .dev.vars <<'EOF'
RESEND_API_KEY="re_..."
LEAD_TO="you@yourdomain.com"
LEAD_FROM="Bou site <website@send.yourdomain.com>"
EOF

npm run dev              # wrangler: assets + /api/lead, on :8787
```

`.dev.vars` is git-ignored. Leave `TURNSTILE_SECRET_KEY` out of it and the
Worker skips the bot check locally.

---

## Day to day, after launch

Edit `content.json` → `npm run build` → commit → push. Cloudflare rebuilds and
publishes in under a minute. Every build prints the placeholders still left;
`npm run build:strict` fails instead of warning, if you want that as a guard.
