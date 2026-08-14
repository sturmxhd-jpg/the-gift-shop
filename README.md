# The Gift Shop 🇬🇾

Deals marketplace for Guyana — **Customer · Business · Rider · Manager**.

Built for **Artistic Marketing Inc.** · [artisticmarketinginc.com](https://www.artisticmarketinginc.com)

## Quick start

```bash
npm install
npm start
```

Open **http://localhost:3000**

## Deploy & Wix integration

See **[DEPLOY\_AND\_WIX.md](./DEPLOY_AND_WIX.md)** for:

1. Local testing
2. Deploy to Railway / Render
3. Adding **The Gift Shop** to your Wix menu

## Demo logins (password: `giftshop`)

| Role | Identifier |
| --- | --- |
| Customer | 592\-612\-3456 |
| Business | island@breeze.gy |
| Rider | 592\-671\-8801 |
| Manager | admin@giftshop.gy |

## Stack

- Frontend: HTML / CSS / JS
- Backend: Node.js (`server.js`)
- Payments (demo): MMG to **6124940**

## Production notes

### Accounts

No demo logins. Users register with **email**; confirmation email includes login details for safekeeping.

### Email

```bash
export RESEND_API_KEY=re_xxxxxxxx
export MAIL_FROM="The Gift Shop <noreply@yourdomain.com>"
node server.js
```

Without a key, emails are written to `data/outbox/`.

### Proof of delivery

Stored in `data/proofs/`; riders can re\-open them under **Delivery proofs**. Customer receives the photo by email when configured.

## Preserve logins & listings across updates

Accounts, deals, orders, riders, ratings, and delivery proofs are all saved in the **`data/`** folder on the server (not only in the browser) — that includes deal photos too, which are now stored on disk and referenced by URL instead of only living in the browser.

**Running your own VPS (DigitalOcean, etc.):** the `data/` folder is just a normal folder on that machine's disk, so it survives on its own between deploys as long as you don't delete it:

1. Stop the server
2. Replace app files (`index.html`, `app.js`, `server.js`, etc.)
3. **Keep / copy over the old `data/` folder** — do not delete it
4. Start `node server.js` again

**Running on Railway, Render, or similar platforms:** these platforms rebuild the app's filesystem from scratch on every deploy, so the steps above don't apply — a plain `data/` folder gets wiped every time no matter what you do. You need to attach a **persistent volume** once, and the app will use it automatically from then on. See **RAILWAY\_DEPLOY\_GUIDE.md → Step 7 — Add persistent storage** for the exact steps. Until that's done, every redeploy resets the app to a blank slate.

Users keep the same email/password. Business product listings (including photos) remain.

Optional backup while running:
`curl http://localhost:3000/api/admin/backup > backup.json`
