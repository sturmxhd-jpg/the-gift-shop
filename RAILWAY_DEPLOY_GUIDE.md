# Deploy The Gift Shop on Railway — Step by step

No coding required beyond uploading this folder.  
Railway gives you **HTTPS automatically**.

---

## What you need

- A computer with this unzipped folder (`the-gift-shop`)
- A free account at **https://railway.app**
- (Optional) GitHub account — easiest upload method

---

## Method A — Deploy with GitHub (recommended)

### Step 1 — Create a GitHub repository

1. Go to **https://github.com/new**
2. Repository name: `the-gift-shop`
3. Set to **Private** (or Public)
4. Click **Create repository**

### Step 2 — Upload the project files

**Option 2a — GitHub website (no Git knowledge)**

1. On the new empty repo page, click **uploading an existing file**
2. Drag **all files inside** the `the-gift-shop` folder (not the outer zip):
   - `server.js`
   - `index.html`
   - `app.js`
   - `styles.css`
   - `package.json`
   - `railway.json`
   - `Procfile`
   - `assets/` folder
   - `README.md`
   - etc.
3. Click **Commit changes**

**Option 2b — Or use Git on your computer**

```bash
cd the-gift-shop
git init
git add .
git commit -m "The Gift Shop initial deploy"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/the-gift-shop.git
git push -u origin main
```

### Step 3 — Sign in to Railway

1. Open **https://railway.app**
2. Click **Login**
3. Sign in with **GitHub** (easiest)

### Step 4 — Create a new project from the repo

1. Click **New Project**
2. Choose **Deploy from GitHub repo**
3. Select **the-gift-shop**
4. If asked, grant Railway access to the repo
5. Railway will start building automatically

### Step 5 — Generate a public HTTPS URL

1. Click the service that appears (often named `the-gift-shop`)
2. Open the **Settings** tab
3. Scroll to **Networking** → **Public Networking**
4. Click **Generate Domain**
5. Copy the URL, for example:  
   `https://the-gift-shop-production-xxxx.up.railway.app`

### Step 6 — Test the app

1. Open that URL in Chrome on your phone or computer  
2. You should see **The Gift Shop** launcher  
3. Try login: `admin@giftshop.gy` / `giftshop`

**HTTPS is already on** — no SSL files to upload.

---

## Method B — Deploy without GitHub (Railway CLI)

1. Install Node.js from https://nodejs.org  
2. Install Railway CLI:

```bash
npm install -g @railway/cli
```

3. Log in:

```bash
railway login
```

4. In the project folder:

```bash
cd the-gift-shop
railway init
railway up
```

5. In the Railway dashboard → service → **Settings** → **Generate Domain**

---

## Connect to your Wix site (artisticmarketinginc.com)

1. Open **Wix Editor**
2. **Menus & Pages** → **Add menu item**
3. Name: **The Gift Shop**
4. Link → **Web address** → paste your Railway URL  
   (`https://….up.railway.app`)
5. Open in **New tab**
6. **Publish** the Wix site

Done — visitors click **The Gift Shop** on your site and open the live app.

---

## Optional: custom domain `shop.artisticmarketinginc.com`

1. Railway service → **Settings** → **Public Networking** → **Custom Domain**
2. Enter: `shop.artisticmarketinginc.com`
3. Add the **CNAME** and **TXT** records Railway shows into your domain DNS (Wix Domains or wherever DNS is managed)
4. Wait until Railway shows the domain as active (SSL is automatic)
5. Update the Wix menu link to `https://shop.artisticmarketinginc.com`

---

## Demo logins (change these before real customers)

| Role     | Login              | Password  |
|----------|--------------------|-----------|
| Customer | 592-612-3456       | giftshop  |
| Business | island@breeze.gy   | giftshop  |
| Rider    | 592-671-8801       | giftshop  |
| Manager  | admin@giftshop.gy  | giftshop  |

---

## If the deploy fails

| Issue | Fix |
|-------|-----|
| Build failed | Ensure `package.json` and `server.js` are in the **root** of the repo (not inside a nested folder) |
| App not reachable | Click **Generate Domain** under Public Networking |
| Blank page | Check **Deployments** logs for errors; confirm start command is `node server.js` |
| Port errors | App already uses `process.env.PORT` — correct for Railway |

---

## Files Railway needs (all included in this package)

```
the-gift-shop/
├── server.js          ← backend + serves the website
├── index.html
├── app.js
├── styles.css
├── package.json       ← npm start → node server.js
├── railway.json       ← Railway settings
├── Procfile
├── assets/
│   └── guyana-flag.png
└── RAILWAY_DEPLOY_GUIDE.md  ← this file
```

You do **not** need to upload `node_modules` or `previews`.

---

## After it works

1. Share the Railway URL with test users  
2. Add the Wix menu link  
3. Later: custom domain + stronger security for production
