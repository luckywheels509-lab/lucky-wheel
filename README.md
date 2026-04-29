# Lucky Wheel

A spin-wheel gaming portal with Telegram jackpot notifications.

## Project Structure

```
index.html   — Main site (static)
style.css    — Styles
script.js    — Spin wheel logic, notifications, sounds
worker.js    — Cloudflare Worker (Telegram bot + contact config API)
wrangler.toml — Cloudflare Worker config
```

---

## Deploy: GitHub Pages (Frontend)

1. Push this repo to GitHub
2. Go to **Settings → Pages → Source** → select `GitHub Actions`
3. The workflow at `.github/workflows/deploy.yml` auto-deploys on every push to `main`/`master`

> `worker.js` is **not** served by GitHub Pages — it runs on Cloudflare Workers separately.

---

## Deploy: Cloudflare Worker (Backend)

### Prerequisites
```bash
npm install -g wrangler
wrangler login
```

### Deploy
```bash
wrangler deploy
```

After deploy, Cloudflare will give you a URL like:
```
https://lucky-wheel-worker.<your-subdomain>.workers.dev
```

Update `WORKER_URL` in `script.js` with that URL:
```js
const WORKER_URL = 'https://lucky-wheel-worker.<your-subdomain>.workers.dev';
```

---

## Config in `worker.js`

| Variable | Description |
|---|---|
| `TG_TOKEN` | Telegram bot token |
| `TG_CHAT_IDS` | Array of chat IDs to receive jackpot alerts |
| `CONTACTS` | Social media links served via `/config` endpoint |
