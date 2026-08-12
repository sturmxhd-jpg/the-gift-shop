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

See **[DEPLOY_AND_WIX.md](./DEPLOY_AND_WIX.md)** for:

1. Local testing  
2. Deploy to Railway / Render  
3. Adding **The Gift Shop** to your Wix menu  

## Demo logins (password: `giftshop`)

| Role     | Identifier            |
|----------|------------------------|
| Customer | 592-612-3456           |
| Business | island@breeze.gy       |
| Rider    | 592-671-8801           |
| Manager  | admin@giftshop.gy      |

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
Stored in `data/proofs/`; riders can re-open them under **Delivery proofs**. Customer receives the photo by email when configured.


## Preserve logins & listings across updates

Accounts and deals are saved in the **`data/`** folder on the server (not only in the browser).

**When installing a new version of the app:**
1. Stop the server
2. Replace app files (`index.html`, `app.js`, `server.js`, etc.)
3. **Keep / copy over the old `data/` folder** — do not delete it
4. Start `node server.js` again

Users keep the same email/password. Business product listings remain.

Optional backup while running:
`curl http://localhost:3000/api/admin/backup > backup.json`
