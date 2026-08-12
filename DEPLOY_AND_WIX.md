# The Gift Shop — Deploy & Connect to Wix
**Artistic Marketing Inc.** · https://www.artisticmarketinginc.com

This guide gets the app online and linked from your Wix site.

---

## Part A — Run locally (test first)

```bash
cd the-gift-shop
npm install
node server.js
```

Open: http://localhost:3000

| Role     | Login                 | Password  |
|----------|-----------------------|-----------|
| Customer | 592-612-3456          | giftshop  |
| Business | island@breeze.gy      | giftshop  |
| Rider    | 592-671-8801          | giftshop  |
| Manager  | admin@giftshop.gy     | giftshop  |

Phone (same Wi‑Fi): use the **Phone URL** printed in the terminal (http://YOUR_PC_IP:3000).

---

## Part B — Deploy online (get a public link)

The app needs **Node.js** hosting (Wix cannot run `server.js` itself).

### Option 1 — Railway (simple)

1. Create a free account at https://railway.app  
2. **New Project** → **Deploy from local** or upload this folder (or connect GitHub if you push the code).  
3. Railway detects Node; set start command: `node server.js`  
4. Generate a **public domain** in Railway (e.g. `the-gift-shop-production.up.railway.app`).  
5. Open that HTTPS URL on your phone — that is your **App URL**.

### Option 2 — Render

1. https://render.com → **New Web Service**  
2. Upload/connect this project  
3. Build: `npm install`  
4. Start: `node server.js`  
5. Use the `onrender.com` HTTPS URL as your **App URL**.

### Option 3 — Any VPS (DigitalOcean, etc.)

```bash
npm install
node server.js
# or use pm2: pm2 start server.js --name giftshop
```

Point Nginx/Caddy to port 3000 and add HTTPS (Let’s Encrypt).

**Save your App URL**, for example:
`https://the-gift-shop-production.up.railway.app`

---

## Part C — Connect to Wix (artisticmarketinginc.com)

### 1. Add menu item

1. Open **Wix Editor** for https://www.artisticmarketinginc.com  
2. Click **Menus & Pages** (or Site Menu)  
3. **Add menu item** → name it: **The Gift Shop**  
4. Choose **Link** → **Web Address**  
5. Paste your **App URL** (from Part B)  
6. Open in: **New tab** (recommended)  
7. **Publish** the site  

Customers click **The Gift Shop** on your site and go straight into the app.

### 2. Optional homepage button

1. On the Home page, add a **Button**  
2. Text: `Open The Gift Shop` or `Browse deals`  
3. Link → same **App URL**  
4. Publish  

### 3. Optional subdomain (professional)

1. In **Wix** → **Settings** → **Domains** (or your DNS provider)  
2. Add subdomain: `shop`  
   - Type: **CNAME** pointing to your host (Railway/Render instructions show the target)  
   - Or use their “custom domain” UI and enter `shop.artisticmarketinginc.com`  
3. After DNS works, app is at:  
   `https://shop.artisticmarketinginc.com`  
4. Update the Wix menu link to that subdomain.

---

## Part D — What stays where

| Piece                         | Platform        |
|------------------------------|-----------------|
| Agency site, posters, signs  | Wix             |
| The Gift Shop (all roles)    | Railway/Render/VPS |
| Menu link “The Gift Shop”    | Wix → App URL   |

Do **not** paste the whole app into a Wix HTML embed for production — use a full-page link.

---

## Part E — After go-live checklist

- [ ] App opens on Android Chrome over HTTPS  
- [ ] Login works for Customer / Business / Rider / Manager  
- [ ] Wix menu item opens the app  
- [ ] MMG number **6124940** correct for your business  
- [ ] Change demo passwords before real customers  
- [ ] Add Privacy Policy / Terms pages (Wix pages are fine)  

---

## Support contact (your site)

Email listed on the main site: **raul@artisticmarketinginc.com**

You can use the same for Gift Shop support inquiries.

---

## Demo vs production note

This package is a **working prototype**. For heavy real traffic:

- Move data from memory/localStorage to a real database  
- Connect live MMG merchant API  
- Change all default passwords  

Fine for **beta and client demos** as deployed above.
