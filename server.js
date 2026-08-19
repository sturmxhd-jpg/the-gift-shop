/**
 * The Gift Shop – Backend (zero dependencies, Node built-ins only)
 * Run:  node server.js
 * Phone: open http://YOUR_COMPUTER_IP:3000 on the same Wi‑Fi
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const MANAGER_USERNAME = 'raulkc';
const MANAGER_PASSWORD = 'tiromini';
const ROOT = __dirname;

function uuid() {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

// ─── Password hashing (scrypt, Node built-in — no extra dependency) ────────
// Stored format: "scrypt$<saltHex>$<hashHex>". Accounts created before this
// was added still have their old plain-text password string — verifyPassword
// falls back to a direct compare for those and the caller re-hashes on a
// successful legacy login, so nobody is locked out by this change.
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}
function isHashedPassword(stored) {
  return typeof stored === 'string' && stored.startsWith('scrypt$');
}
function verifyPassword(password, stored) {
  if (!stored) return false;
  if (isHashedPassword(stored)) {
    const parts = stored.split('$');
    if (parts.length !== 3) return false;
    const [, salt, hashHex] = parts;
    try {
      const hashBuf = Buffer.from(hashHex, 'hex');
      const testBuf = crypto.scryptSync(String(password), salt, 64);
      return hashBuf.length === testBuf.length && crypto.timingSafeEqual(hashBuf, testBuf);
    } catch (e) {
      return false;
    }
  }
  // Legacy plain-text account — direct compare (migrated to a hash by the caller on success)
  return stored === password;
}

// ─── Data store ────────────────────────────────────────────────────────────
let deals = [];


let riders = [];


const orders = [];
const ratings = [];
let availableJobs = [];



// Persistent storage (users + delivery proofs)
// DATA_DIR points at a mounted persistent volume so this survives redeploys —
// otherwise it lives on the app's own throwaway filesystem, which most hosts
// (Railway, Render, etc.) rebuild from scratch on every deploy.
// - Railway: attaching a Volume to this service auto-sets RAILWAY_VOLUME_MOUNT_PATH —
//   no manual config needed, it's picked up automatically below.
// - Any host: set DATA_DIR yourself to override.
// - Neither set (e.g. local `node server.js`): falls back to ./data.
// See RAILWAY_DEPLOY_GUIDE.md for step-by-step Volume setup.
const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : (process.env.RAILWAY_VOLUME_MOUNT_PATH
      ? path.resolve(process.env.RAILWAY_VOLUME_MOUNT_PATH)
      : path.join(ROOT, 'data'));
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const PROOFS_FILE = path.join(DATA_DIR, 'proofs.json');
const DEALS_FILE = path.join(DATA_DIR, 'deals.json');
const JOBS_FILE = path.join(DATA_DIR, 'jobs.json');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const RIDERS_FILE = path.join(DATA_DIR, 'riders.json');
const RATINGS_FILE = path.join(DATA_DIR, 'ratings.json');
const ADS_FILE = path.join(DATA_DIR, 'ads.json');
const META_FILE = path.join(DATA_DIR, 'meta.json');
const OUTBOX_DIR = path.join(DATA_DIR, 'outbox');
const DEAL_PHOTOS_DIR = path.join(DATA_DIR, 'deal-photos');
const RIDER_PHOTOS_DIR = path.join(DATA_DIR, 'rider-photos');
const AD_PHOTOS_DIR = path.join(DATA_DIR, 'ad-photos');

function ensureDataDirs() {
  [DATA_DIR, OUTBOX_DIR, path.join(DATA_DIR, 'proofs'), DEAL_PHOTOS_DIR, RIDER_PHOTOS_DIR, AD_PHOTOS_DIR].forEach(d => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  });
}
ensureDataDirs();

function loadJSON(file, fallback) {
  try {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) { console.warn('loadJSON', file, e.message); }
  return fallback;
}
function saveJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

let users = loadJSON(USERS_FILE, []);
let deliveryProofs = loadJSON(PROOFS_FILE, []);
deals = loadJSON(DEALS_FILE, []);
availableJobs = loadJSON(JOBS_FILE, []);
riders = loadJSON(RIDERS_FILE, []);
// Backfill fields added after some riders.json files were first created.
riders.forEach(r => {
  if (r.plan === undefined) r.plan = 'free';
  if (r.paidUntil === undefined) r.paidUntil = null;
  if (r.photo === undefined) r.photo = null;
});
let platformAds = loadJSON(ADS_FILE, []);
// orders/ratings already exist as const orders = [] / const ratings = []
try { const o = loadJSON(ORDERS_FILE, null); if (Array.isArray(o)) { while (orders.length) orders.pop(); o.forEach(x => orders.push(x)); } } catch (_) {}
try { const r = loadJSON(RATINGS_FILE, null); if (Array.isArray(r)) { while (ratings.length) ratings.pop(); r.forEach(x => ratings.push(x)); } } catch (_) {}
function persistDeals() { saveJSON(DEALS_FILE, deals); }
function persistJobs() { saveJSON(JOBS_FILE, availableJobs); }
function persistOrders() { saveJSON(ORDERS_FILE, orders); }
function persistRiders() { saveJSON(RIDERS_FILE, riders); }
function persistRatings() { saveJSON(RATINGS_FILE, ratings); }
function persistAds() { saveJSON(ADS_FILE, platformAds); }
function persistAllData() {
  persistUsers();
  persistDeals();
  persistJobs();
  persistOrders();
  persistProofs();
  persistRiders();
  persistRatings();
  persistAds();
  saveJSON(META_FILE, { lastSaved: new Date().toISOString(), users: users.length, deals: deals.length, jobs: availableJobs.length, riders: riders.length });
}
console.log('[Gift Shop] Data dir: ' + DATA_DIR);
console.log('[Gift Shop] Loaded data: users=' + users.length + ' deals=' + deals.length + ' jobs=' + availableJobs.length + ' riders=' + riders.length + ' orders=' + orders.length + ' ratings=' + ratings.length);
if (!process.env.DATA_DIR && !process.env.RAILWAY_VOLUME_MOUNT_PATH) {
  console.log('[Gift Shop] WARNING: no persistent volume detected — using local folder ' + DATA_DIR + '. On Railway/Render this folder is wiped on every redeploy unless it sits on a mounted persistent volume (or DATA_DIR points at one). See RAILWAY_DEPLOY_GUIDE.md.');
}

const passwordResetTokens = new Map(); // email -> { code, exp }

function persistUsers() { saveJSON(USERS_FILE, users); }
function persistProofs() { saveJSON(PROOFS_FILE, deliveryProofs); }

/** Decode a data:image/...;base64,... URL and save it to disk under `dir`, returning a public /data/<publicSubdir>/... URL. Returns the input unchanged if it isn't a data URL (e.g. already a saved path, or null). */
function savePhoto(dir, publicSubdir, prefix, id, photoInput) {
  if (!photoInput) return null;
  if (!String(photoInput).startsWith('data:image')) return photoInput; // already a URL/path
  const m = String(photoInput).match(/^data:(image\/\w+);base64,(.+)$/);
  if (!m) return null;
  const ext = m[1].split('/')[1] === 'jpeg' ? 'jpg' : m[1].split('/')[1];
  const fname = prefix + '-' + id + '-' + Date.now() + '.' + ext;
  const fpath = path.join(dir, fname);
  fs.writeFileSync(fpath, Buffer.from(m[2], 'base64'));
  return '/data/' + publicSubdir + '/' + fname;
}
function saveDealPhoto(id, photoInput) {
  return savePhoto(DEAL_PHOTOS_DIR, 'deal-photos', 'DEAL', id, photoInput);
}
function saveRiderPhoto(id, photoInput) {
  return savePhoto(RIDER_PHOTOS_DIR, 'rider-photos', 'RIDER', id, photoInput);
}
function saveAdPhoto(id, photoInput) {
  return savePhoto(AD_PHOTOS_DIR, 'ad-photos', 'AD', id, photoInput);
}

// ─── Geo / dispatch helpers ────────────────────────────────────────────────
// Note: this prototype has no real geocoding, so a "pickup point" is often a
// fixed approximate Georgetown coordinate rather than the business's true
// address. Distances are still computed for real between that point and each
// rider's real (or simulated) GPS position, so "closest available rider"
// dispatch is functionally real even though the pickup point itself is
// approximate. Wire up a geocoding service and pass real business
// coordinates through to make it fully accurate.
function haversineKm(lat1, lon1, lat2, lon2) {
  if ([lat1, lon1, lat2, lon2].some(v => typeof v !== 'number' || Number.isNaN(v))) return Infinity;
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
// ─── Delivery pricing ───────────────────────────────────────────────────────
// Standard rate: GYD 700/mile (pickup-at-business → drop-off-at-customer),
// plus GYD 100/minute of rider waiting time at the business (see
// computeDeliveryFee / the pickup gate below). Businesses don't store real
// pickup coordinates today, so pickup falls back to the Georgetown-centre
// point already used elsewhere (closestEligibleRider's default) — the same
// approximation used throughout the app when a business address hasn't been
// geocoded.
const MILE_RATE_GYD = 700;
const WAIT_RATE_PER_MIN_GYD = 100;
const KM_TO_MILES = 0.621371;
const DEFAULT_PICKUP_LAT = 6.812;
const DEFAULT_PICKUP_LNG = -58.155;
function haversineMiles(lat1, lon1, lat2, lon2) {
  return haversineKm(lat1, lon1, lat2, lon2) * KM_TO_MILES;
}
/** Real per-mile delivery fee from pickup (business) to drop-off (customer). Minimum charge is 1 mile so a very close drop-off is never billed GYD 0. */
function computeDeliveryFee(pickupLat, pickupLng, dropLat, dropLng) {
  const pLat = typeof pickupLat === 'number' ? pickupLat : DEFAULT_PICKUP_LAT;
  const pLng = typeof pickupLng === 'number' ? pickupLng : DEFAULT_PICKUP_LNG;
  const dLat = typeof dropLat === 'number' ? dropLat : DEFAULT_PICKUP_LAT;
  const dLng = typeof dropLng === 'number' ? dropLng : DEFAULT_PICKUP_LNG;
  const rawMiles = haversineMiles(pLat, pLng, dLat, dLng);
  const miles = Math.round(rawMiles * 10) / 10;
  const billedMiles = Math.max(1, miles);
  return { miles, fee: Math.round(billedMiles * MILE_RATE_GYD) };
}

const FREE_RIDER_JOB_CAP = 3;
const PAID_RIDER_JOB_CAP = 10;
const RIDER_SUB_FEE_GYD = 5000;
function riderIsPaid(rider) {
  return !!(rider && rider.plan === 'paid' && rider.paidUntil && new Date(rider.paidUntil).getTime() > Date.now());
}
function riderJobCap(rider) {
  return riderIsPaid(rider) ? PAID_RIDER_JOB_CAP : FREE_RIDER_JOB_CAP;
}
function riderActiveJobCount(riderId) {
  return orders.filter(o => o.rider && o.rider.id === riderId && o.status !== 'delivered').length;
}

// ─── Business plan / listing limits ────────────────────────────────────────
// Every business gets ONE free deal listing per month. Any listing beyond
// that in the same rolling 30-day window requires an active paid monthly
// subscription (GYD 5,000/mo via MMG, up to 10 listings/month). Enforced
// here — not just in the UI — so it can't be bypassed by clearing local
// storage or signing in on a different device. The count is a rolling
// 30-day window rather than a stored counter, so it self-resets every
// month with no separate cron/reset job needed.
const FREE_LISTING_LIMIT = 1;
const PAID_LISTING_LIMIT = 10;
const BUSINESS_SUB_FEE_GYD = 5000;
const LISTING_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
function businessIsPaid(business) {
  return !!(business && business.plan === 'paid' && business.paidUntil && new Date(business.paidUntil).getTime() > Date.now());
}
function businessDealCount(businessId) {
  const cutoff = Date.now() - LISTING_WINDOW_MS;
  return deals.filter(d => d.businessId === businessId && new Date(d.createdAt || 0).getTime() > cutoff).length;
}
function businessListingLimit(business) {
  return businessIsPaid(business) ? PAID_LISTING_LIMIT : FREE_LISTING_LIMIT;
}

// Customer-purchased ads: GYD 1,000/day, 3-day minimum, or a flat GYD 5,000
// 7-day package. Paid in full (MMG transaction code) before the ad goes live.
const CUSTOMER_AD_MIN_DAYS = 3;
const CUSTOMER_AD_DAILY_RATE_GYD = 1000;
const CUSTOMER_AD_WEEK_DAYS = 7;
const CUSTOMER_AD_WEEK_RATE_GYD = 5000;
function customerAdCost(days) {
  const d = Math.max(CUSTOMER_AD_MIN_DAYS, Math.floor(Number(days) || 0));
  return d === CUSTOMER_AD_WEEK_DAYS ? CUSTOMER_AD_WEEK_RATE_GYD : d * CUSTOMER_AD_DAILY_RATE_GYD;
}
/** Flip any ad whose paid placement window has passed from Active to Expired so listings stay accurate. */
function sweepExpiredAds() {
  let changed = false;
  const now = Date.now();
  platformAds.forEach(a => {
    if (a.status === 'Active' && a.expiresAt && new Date(a.expiresAt).getTime() <= now) {
      a.status = 'Expired';
      changed = true;
    }
  });
  if (changed) persistAds();
}
/** The single best rider to offer a job at (lat,lng) to right now: online, under their cap, hasn't declined this job, closest first. Returns null if nobody qualifies. */
function closestEligibleRider(lat, lng, excludeRiderIds) {
  const excluded = excludeRiderIds ? new Set(excludeRiderIds) : null;
  const candidates = riders
    .filter(r => r.online)
    .filter(r => !excluded || !excluded.has(r.id))
    .filter(r => riderActiveJobCount(r.id) < riderJobCap(r))
    .map(r => ({ r, dist: haversineKm(lat, lng, r.lat, r.lng) }))
    .sort((a, b) => a.dist - b.dist);
  return candidates.length ? candidates[0] : null;
}

/** Send email: uses RESEND_API_KEY if set, otherwise writes to data/outbox for review */
async function sendEmail({ to, subject, text, html, attachments }) {
  const from = process.env.MAIL_FROM || 'The Gift Shop <noreply@thegiftshop.gy>';
  const record = {
    id: 'MAIL-' + Date.now(),
    to, subject, text, html: html || null,
    attachments: (attachments || []).map(a => ({ filename: a.filename, contentType: a.contentType })),
    createdAt: new Date().toISOString(),
    status: 'queued'
  };

  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey && to) {
    try {
      const payload = {
        from,
        to: [to],
        subject,
        text,
        html: html || undefined
      };
      if (attachments && attachments.length) {
        payload.attachments = attachments.map(a => ({
          filename: a.filename,
          content: a.contentBase64
        }));
      }
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      const body = await res.json().catch(() => ({}));
      record.status = res.ok ? 'sent' : 'failed';
      record.provider = 'resend';
      record.response = body;
      fs.writeFileSync(path.join(OUTBOX_DIR, record.id + '.json'), JSON.stringify(record, null, 2));
      console.log('[email]', record.status, to, subject);
      return { sent: res.ok, record };
    } catch (e) {
      record.status = 'failed';
      record.error = e.message;
      fs.writeFileSync(path.join(OUTBOX_DIR, record.id + '.json'), JSON.stringify(record, null, 2));
      return { sent: false, record };
    }
  }

  // No API key: save to outbox (production: set RESEND_API_KEY)
  record.status = 'outbox';
  // Store attachment refs separately if huge
  const outPath = path.join(OUTBOX_DIR, record.id + '.json');
  const toWrite = { ...record };
  if (attachments && attachments.length) {
    toWrite.attachmentFiles = [];
    attachments.forEach((a, i) => {
      const fname = record.id + '_' + (a.filename || ('file' + i));
      const fpath = path.join(OUTBOX_DIR, fname);
      if (a.contentBase64) {
        fs.writeFileSync(fpath, Buffer.from(a.contentBase64, 'base64'));
        toWrite.attachmentFiles.push(fname);
      }
    });
  }
  fs.writeFileSync(outPath, JSON.stringify(toWrite, null, 2));
  console.log('[email:outbox]', to, subject, '→', outPath);
  return { sent: false, queued: true, record };
}

function isEmail(s) {
  return typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}


function publicUser(u) {
  const { password, ...rest } = u;
  return rest;
}

const businessStats = { name: '', plan: 'trial', weekSales: 0, orders: 0, activeDeals: 0, netPayout: 0 };


// ─── Helpers ───────────────────────────────────────────────────────────────
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

function sendJSON(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function serveStatic(req, res, pathname) {
  // /data/... is served from DATA_DIR (which may be a separate mounted
  // volume, not necessarily under ROOT) — everything else from ROOT.
  const isDataPath = pathname.startsWith('/data/');
  const base = isDataPath ? DATA_DIR : ROOT;
  let filePath = isDataPath
    ? path.join(DATA_DIR, pathname.slice('/data/'.length))
    : path.join(ROOT, pathname === '/' ? 'index.html' : pathname);
  // Prevent path traversal
  if (!filePath.startsWith(base)) {
    res.writeHead(403); return res.end('Forbidden');
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (pathname.startsWith('/api')) {
        return sendJSON(res, 404, { error: 'Not found' });
      }
      // Do not SPA-fallback for real assets (images, css, js) — return 404
      const ext = path.extname(pathname).toLowerCase();
      if (['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico', '.css', '.js', '.woff', '.woff2'].includes(ext)) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        return res.end('Not found: ' + pathname);
      }
      // SPA fallback for app routes only
      fs.readFile(path.join(ROOT, 'index.html'), (e2, html) => {
        if (e2) { res.writeHead(404); return res.end('Not found'); }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html);
      });
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

// ─── API router ────────────────────────────────────────────────────────────
async function handleAPI(req, res, pathname, query) {
  const method = req.method;

  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }

  // Health
  if (pathname === '/api/health' && method === 'GET') {
    return sendJSON(res, 200, {
      ok: true, app: 'The Gift Shop', country: 'Guyana',
      time: new Date().toISOString(),
      orders: orders.length,
      ridersOnline: riders.filter(r => r.online).length
    });
  }

  // Deals
  if (pathname === '/api/deals' && method === 'GET') {
    let list = deals.filter(d => !d._paused);
    if (query.category && query.category !== 'all') {
      list = list.filter(d => d.category === query.category);
    }
    return sendJSON(res, 200, { deals: list });
  }


  if (pathname === '/api/deals' && method === 'POST') {
    try {
      const body = await readBody(req);
      if (!body.title || !body.price) {
        return sendJSON(res, 400, { error: 'title and price required' });
      }
      const id = body.id || (deals.length ? Math.max(...deals.map(d => Number(d.id) || 0)) + 1 : Date.now());
      const existing = deals.find(d => String(d.id) === String(id));

      // Resolve the real business account (if one was supplied) so listing
      // ownership and the free-listing limit are enforced server-side, not
      // just in the UI — a business can't get more free listings just by
      // clearing local storage or switching devices.
      let business = null;
      if (body.businessId) {
        business = users.find(u => u.id === body.businessId && u.role === 'business');
        if (!business) return sendJSON(res, 400, { error: 'Business account not found' });
      }

      if (!existing) {
        // New listing — enforce the free-plan limit for real business accounts.
        if (business) {
          const limit = businessListingLimit(business);
          const count = businessDealCount(business.id);
          if (count >= limit) {
            return sendJSON(res, 402, {
              error: businessIsPaid(business)
                ? `Paid plan allows up to ${PAID_LISTING_LIMIT} listings this month. Limit reached.`
                : `Your free monthly listing is already used. Subscribe (GYD ${BUSINESS_SUB_FEE_GYD.toLocaleString()}/mo via MMG 61214940) for up to ${PAID_LISTING_LIMIT} listings a month.`
            });
          }
        }
      } else if (business && existing.businessId && existing.businessId !== business.id) {
        return sendJSON(res, 403, { error: 'This listing belongs to a different business account' });
      }

      let photo = (existing && existing.photo) || null;
      if (body.photo && body.photo !== '[image]') {
        try { photo = saveDealPhoto(id, body.photo); } catch (e) { console.warn('saveDealPhoto failed', e.message); }
      }
      const deal = {
        id,
        businessId: business ? business.id : ((existing && existing.businessId) || null),
        // Trust the real account's business name over a client-supplied string once we have one.
        business: (business && business.businessName) || body.business || (existing && existing.business) || 'Local Business',
        // Used to compute the rolling 30-day free-listing window — keep the
        // original creation time on edits, don't reset it every save.
        createdAt: (existing && existing.createdAt) || new Date().toISOString(),
        title: body.title,
        price: Number(body.price),
        original: Number(body.original) || Number(body.price),
        discount: body.discount || 0,
        category: body.category || 'food',
        emoji: body.emoji || '🎁',
        description: body.description || body.title,
        daysLeft: body.daysLeft || 5,
        distance: body.distance || '1.0 km',
        delivery: body.delivery !== false,
        photo,
        _paused: !!body._paused
      };
      if (existing) {
        Object.assign(existing, deal);
      } else {
        deals.unshift(deal);
      }
      if (typeof persistDeals === 'function') persistDeals();
      return sendJSON(res, 201, { success: true, deal });
    } catch (e) {
      console.error(e);
      return sendJSON(res, 400, { error: 'Invalid JSON' });
    }
  }

  const dealMatch = pathname.match(/^\/api\/deals\/(\d+)$/);
  if (dealMatch && method === 'GET') {
    const deal = deals.find(d => d.id === Number(dealMatch[1]));
    if (!deal) return sendJSON(res, 404, { error: 'Deal not found' });
    return sendJSON(res, 200, deal);
  }

  // Orders
  if (pathname === '/api/orders' && method === 'GET') {
    return sendJSON(res, 200, orders);
  }

  if (pathname === '/api/orders' && method === 'POST') {
    try {
      const body = await readBody(req);
      const { items, fulfillment, paymentMethod, deliveryAddress, deliveryPhone, deliveryNotes, mmgPhone, subtotal, pickupLat, pickupLng, deliveryLat, deliveryLng, customerId, customerName, customerEmail } = body;
      if (!items || !items.length) return sendJSON(res, 400, { error: 'Cart is empty' });
      if (fulfillment === 'delivery' && (!deliveryAddress || !deliveryPhone)) {
        return sendJSON(res, 400, { error: 'Delivery address and contact number required' });
      }
      // Tag each item with the business that listed it (looked up from the
      // live deals catalogue by item id) so orders/revenue can be scoped to
      // the correct business later — the client only sends title/price/qty,
      // it doesn't need to know or claim a business id itself.
      const taggedItems = items.map(item => {
        const deal = deals.find(d => String(d.id) === String(item.id));
        return {
          ...item,
          businessId: deal ? deal.businessId || null : null,
          business: deal ? deal.business : null
        };
      });
      const resolvedPickupLat = typeof pickupLat === 'number' ? pickupLat : DEFAULT_PICKUP_LAT;
      const resolvedPickupLng = typeof pickupLng === 'number' ? pickupLng : DEFAULT_PICKUP_LNG;
      const resolvedDropLat = typeof deliveryLat === 'number' ? deliveryLat : null;
      const resolvedDropLng = typeof deliveryLng === 'number' ? deliveryLng : null;
      // Real per-mile delivery fee — GYD 700/mile, pickup (business) to
      // drop-off (customer). Computed server-side from real distance so it
      // can't be spoofed by the client; waiting-time fee (GYD 100/min) is
      // added later, once the order is actually picked up (see the
      // ready-for-pickup / arrived-pickup / status:picked_up handlers below).
      const feeCalc = fulfillment === 'delivery'
        ? computeDeliveryFee(resolvedPickupLat, resolvedPickupLng, resolvedDropLat, resolvedDropLng)
        : { miles: 0, fee: 0 };
      const order = {
        id: 'ORD-' + uuid(),
        items: taggedItems,
        fulfillment: fulfillment || 'pickup',
        paymentMethod: paymentMethod || 'cod',
        customerId: customerId || null,
        customerName: customerName || null,
        customerEmail: customerEmail || null,
        deliveryAddress: deliveryAddress || null,
        deliveryPhone: deliveryPhone || null,
        deliveryNotes: deliveryNotes || '',
        // Pickup (business) and drop-off (customer) coordinates — best effort;
        // used for the per-mile fee above and for rider dispatch below.
        pickupLat: resolvedPickupLat,
        pickupLng: resolvedPickupLng,
        deliveryLat: resolvedDropLat,
        deliveryLng: resolvedDropLng,
        distanceMiles: feeCalc.miles,
        mmgPhone: mmgPhone || null,
        subtotal: subtotal || items.reduce((s, i) => s + i.price * i.qty, 0),
        deliveryFee: feeCalc.fee,
        // No rider is assigned at creation time — the order is instead posted
        // to the rider job board (below) and a rider must explicitly accept
        // it via POST /api/riders/jobs/:id/accept, per the real dispatch flow
        // (notify riders → rider accepts → business confirms ready → pickup).
        status: 'confirmed',
        rider: null,
        readyForPickupAt: null,
        arrivedAtPickupAt: null,
        pickedUpAt: null,
        waitingMinutes: 0,
        waitingFee: 0,
        createdAt: new Date().toISOString(),
        podPhoto: null, podNotes: null
      };
      order.total = order.subtotal + order.deliveryFee;
      orders.unshift(order);

      // Post the delivery to the rider job board — the single real path that
      // notifies riders a job is available (they see it via GET
      // /api/riders/jobs?riderId=... and accept it explicitly). This
      // replaces the old client-side duplicate POST to /api/riders/jobs so
      // there's exactly one order-creation path driving both records.
      if (order.fulfillment === 'delivery') {
        const primaryBusiness = taggedItems.find(i => i.business)?.business || 'Business';
        const itemSummary = taggedItems.map(i => i.title || i.name || 'Item').join(', ');
        availableJobs.unshift({
          id: order.id,
          business: primaryBusiness,
          item: itemSummary,
          address: order.deliveryAddress || '',
          phone: order.deliveryPhone || '',
          customer: order.customerName || 'Customer',
          fee: order.deliveryFee,
          distance: order.distanceMiles ? (order.distanceMiles + ' mi') : '—',
          lat: order.pickupLat,
          lng: order.pickupLng,
          total: order.subtotal,
          createdAt: order.createdAt,
          status: 'available',
          declinedBy: []
        });
        persistJobs();
      }

      persistOrders();
      return sendJSON(res, 201, {
        success: true, order,
        message: fulfillment === 'delivery'
          ? 'Order placed! Nearby riders have been notified.'
          : 'Order placed! Show your voucher in-store.'
      });
    } catch (e) {
      return sendJSON(res, 400, { error: 'Invalid JSON body' });
    }
  }

  // Real-time, business-scoped order feed (status, assigned rider, pickup
  // confirmation timestamp) — what the business "Incoming Orders" panel
  // polls instead of relying on local-only/simulated order state.
  if (pathname === '/api/business/orders' && method === 'GET') {
    const businessId = query.businessId;
    if (!businessId) return sendJSON(res, 400, { error: 'businessId required' });
    const mine = orders.filter(o => o.items.some(i => i.businessId === businessId));
    const mapped = mine.map(o => {
      const myItems = o.items.filter(i => i.businessId === businessId);
      const myTotal = myItems.reduce((s, i) => s + (i.price || 0) * (i.qty || 1), 0);
      return {
        id: o.id,
        item: myItems.map(i => i.title || i.name || 'Item').join(', '),
        customer: o.customerName || 'Customer',
        type: o.fulfillment === 'delivery' ? 'Delivery' : 'Pickup',
        total: myTotal,
        status: o.status,
        rider: o.rider ? { name: o.rider.name, phone: o.rider.phone } : null,
        readyForPickupAt: o.readyForPickupAt || null,
        createdAt: o.createdAt
      };
    });
    return sendJSON(res, 200, { orders: mapped });
  }

  const orderMatch = pathname.match(/^\/api\/orders\/([^/]+)$/);
  if (orderMatch && method === 'GET') {
    const order = orders.find(o => o.id === orderMatch[1]);
    if (!order) return sendJSON(res, 404, { error: 'Order not found' });
    return sendJSON(res, 200, order);
  }

  // Business confirms the order is physically ready for the rider to
  // collect. This is the gate the pickup step below enforces — a rider
  // cannot mark an order picked up until this has happened.
  const readyMatch = pathname.match(/^\/api\/orders\/([^/]+)\/ready-for-pickup$/);
  if (readyMatch && method === 'POST') {
    const order = orders.find(o => o.id === readyMatch[1]);
    if (!order) return sendJSON(res, 404, { error: 'Order not found' });
    if (order.status === 'picked_up' || order.status === 'delivered') {
      return sendJSON(res, 400, { error: 'This order has already been picked up.' });
    }
    order.status = 'ready_for_pickup';
    order.readyForPickupAt = new Date().toISOString();
    persistOrders();
    return sendJSON(res, 200, { success: true, order });
  }

  // Rider marks that they've arrived at the business to collect the order —
  // starts the waiting-time clock (GYD 100/min) used if the business hasn't
  // confirmed ready-for-pickup yet.
  const arrivedMatch = pathname.match(/^\/api\/orders\/([^/]+)\/arrived-pickup$/);
  if (arrivedMatch && method === 'POST') {
    const order = orders.find(o => o.id === arrivedMatch[1]);
    if (!order) return sendJSON(res, 404, { error: 'Order not found' });
    if (!order.arrivedAtPickupAt) {
      order.arrivedAtPickupAt = new Date().toISOString();
      persistOrders();
    }
    return sendJSON(res, 200, { success: true, order });
  }

  const orderStatusMatch = pathname.match(/^\/api\/orders\/([^/]+)\/status$/);
  if (orderStatusMatch && method === 'PATCH') {
    try {
      const body = await readBody(req);
      const order = orders.find(o => o.id === orderStatusMatch[1]);
      if (!order) return sendJSON(res, 404, { error: 'Order not found' });

      if (body.status === 'picked_up') {
        // The business must have confirmed the order is ready before a
        // rider is allowed to mark it picked up — this is the requested
        // "business confirms availability, only then rider can pick up" gate.
        if (order.status !== 'ready_for_pickup') {
          return sendJSON(res, 400, { error: "The business hasn't confirmed this order is ready for pickup yet." });
        }
        const nowIso = new Date().toISOString();
        order.pickedUpAt = nowIso;
        // Waiting-time fee: only billed if the rider arrived at the business
        // before it confirmed ready — GYD 100/min for the gap.
        if (order.arrivedAtPickupAt && order.readyForPickupAt) {
          const arrived = new Date(order.arrivedAtPickupAt).getTime();
          const ready = new Date(order.readyForPickupAt).getTime();
          if (arrived < ready) {
            const waitMinutes = Math.ceil((ready - arrived) / 60000);
            order.waitingMinutes = waitMinutes;
            order.waitingFee = waitMinutes * WAIT_RATE_PER_MIN_GYD;
            order.total = (order.total || 0) + order.waitingFee;
          }
        }
        order.status = 'picked_up';
      } else if (body.status === 'delivered') {
        if (order.status !== 'picked_up') {
          return sendJSON(res, 400, { error: 'This order has not been picked up yet.' });
        }
        order.status = 'delivered';
        order.deliveredAt = new Date().toISOString();
      } else if (body.status) {
        order.status = body.status;
      }
      if (body.podPhoto) order.podPhoto = body.podPhoto;
      if (body.podNotes !== undefined) order.podNotes = body.podNotes;
      persistOrders();
      return sendJSON(res, 200, order);
    } catch (e) {
      return sendJSON(res, 400, { error: 'Invalid JSON' });
    }
  }

  // Riders
  if (pathname === '/api/riders' && method === 'GET') {
    return sendJSON(res, 200, riders.map(r => ({
      id: r.id, name: r.name, phone: r.phone,
      rating: r.rating, ratingCount: r.ratingCount,
      avatar: r.avatar, online: r.online, photo: r.photo || null,
      plan: riderIsPaid(r) ? 'paid' : 'free', paidUntil: r.paidUntil || null,
      activeJobs: riderActiveJobCount(r.id), jobCap: riderJobCap(r)
    })));
  }

  // Jobs currently up for grabs. With ?riderId=..., only jobs where THIS
  // rider is the single closest online, under-cap rider are included —
  // that's what implements "show only to the closest rider; if they're
  // offline or already at their cap, fall through to the next-closest one"
  // (recomputed fresh on every poll, so it always reflects current
  // online/cap state without needing a separate reassignment step).
  // Without ?riderId= (e.g. the manager dashboard), every open job is
  // returned unfiltered.
  if (pathname === '/api/riders/jobs' && method === 'GET') {
    const riderId = query.riderId;
    if (!riderId) return sendJSON(res, 200, { jobs: availableJobs });
    const mine = availableJobs
      .map(j => {
        const best = closestEligibleRider(j.lat, j.lng, j.declinedBy);
        return best && best.r.id === riderId ? { ...j, distanceKm: Math.round(best.dist * 10) / 10 } : null;
      })
      .filter(Boolean);
    const rider = riders.find(r => r.id === riderId);
    return sendJSON(res, 200, {
      jobs: mine,
      activeJobs: rider ? riderActiveJobCount(rider.id) : 0,
      jobCap: rider ? riderJobCap(rider) : FREE_RIDER_JOB_CAP
    });
  }

  if (pathname === '/api/riders/jobs' && method === 'POST') {
    try {
      const body = await readBody(req);
      if (!body.id || !body.item) {
        return sendJSON(res, 400, { error: 'id and item required' });
      }
      if (!String(body.id).startsWith('ORD-')) {
        return sendJSON(res, 400, { error: 'Invalid job id' });
      }
      const exists = availableJobs.find(j => j.id === body.id);
      if (!exists) {
        availableJobs.unshift({
          id: body.id,
          business: body.business || 'Business',
          item: body.item,
          address: body.address || '',
          phone: body.phone || '',
          customer: body.customer || 'Customer',
          fee: body.fee || 400,
          distance: body.distance || '—',
          lat: body.lat || 6.812,
          lng: body.lng || -58.155,
          total: body.total || 0,
          createdAt: body.createdAt || new Date().toISOString(),
          status: 'available',
          declinedBy: []
        });
      }
      if (typeof persistJobs === 'function') persistJobs();
      return sendJSON(res, 201, { success: true, jobs: availableJobs });
    } catch (e) {
      return sendJSON(res, 400, { error: 'Invalid JSON' });
    }
  }

  const acceptMatch = pathname.match(/^\/api\/riders\/jobs\/([^/]+)\/accept$/);
  if (acceptMatch && method === 'POST') {
    try {
      const body = await readBody(req);
      const idx = availableJobs.findIndex(j => j.id === acceptMatch[1]);
      if (idx === -1) return sendJSON(res, 404, { error: 'Job not found — it may already have been taken' });
      const rider = riders.find(r => r.id === body.riderId) || (body.riderId ? null : riders[0]);
      if (!rider) return sendJSON(res, 400, { error: 'riderId required' });
      const cap = riderJobCap(rider);
      const activeCount = riderActiveJobCount(rider.id);
      if (activeCount >= cap) {
        return sendJSON(res, 403, {
          error: riderIsPaid(rider)
            ? `You already have ${activeCount}/${cap} active jobs (Pro Rider limit). Finish one before accepting another.`
            : `You already have ${activeCount}/${cap} active jobs (Free plan limit). Upgrade to Pro Rider (GYD ${RIDER_SUB_FEE_GYD.toLocaleString()}/mo) for up to ${PAID_RIDER_JOB_CAP} at once, or finish one first.`
        });
      }
      const job = availableJobs.splice(idx, 1)[0];
      if (typeof persistJobs === 'function') persistJobs();
      const riderInfo = { id: rider.id, name: rider.name, phone: rider.phone, rating: rider.rating, ratingCount: rider.ratingCount, photo: rider.photo || null, lat: rider.lat, lng: rider.lng };
      // Keep the canonical order record (used for cap accounting + customer
      // tracking) in sync with who actually accepted the job. Jobs normally
      // originate from a real checkout order with the same id — but if one
      // doesn't exist (e.g. a job posted without going through checkout),
      // synthesize a minimal order record so cap accounting always has
      // something real to count against instead of silently under-counting.
      let order = orders.find(o => o.id === job.id);
      if (order) {
        order.rider = riderInfo;
        if (order.status === 'confirmed') order.status = 'accepted';
      } else {
        order = {
          id: job.id,
          items: [{ id: job.id, title: job.item, price: job.total || job.fee || 0, qty: 1 }],
          fulfillment: 'delivery',
          paymentMethod: 'cod',
          deliveryAddress: job.address || null,
          deliveryPhone: job.phone || null,
          deliveryNotes: '',
          deliveryLat: null, deliveryLng: null,
          mmgPhone: null,
          subtotal: job.total || 0,
          deliveryFee: job.fee || 0,
          status: 'accepted',
          rider: riderInfo,
          createdAt: job.createdAt || new Date().toISOString(),
          podPhoto: null, podNotes: null,
          total: (job.total || 0) + (job.fee || 0)
        };
        orders.unshift(order);
      }
      persistOrders();
      return sendJSON(res, 200, {
        success: true,
        job: { ...job, status: 'active', rider: riderInfo },
        activeJobs: riderActiveJobCount(rider.id),
        jobCap: cap
      });
    } catch (e) {
      return sendJSON(res, 400, { error: 'Invalid JSON' });
    }
  }

  const declineMatch = pathname.match(/^\/api\/riders\/jobs\/([^/]+)\/decline$/);
  if (declineMatch && method === 'POST') {
    try {
      const body = await readBody(req);
      const job = availableJobs.find(j => j.id === declineMatch[1]);
      if (!job) return sendJSON(res, 404, { error: 'Job not found — it may already have been taken' });
      if (!body.riderId) return sendJSON(res, 400, { error: 'riderId required' });
      if (!Array.isArray(job.declinedBy)) job.declinedBy = [];
      if (!job.declinedBy.includes(body.riderId)) job.declinedBy.push(body.riderId);
      persistJobs();
      // Immediately compute who it should go to next, so the client can
      // show something useful without waiting for the next poll.
      const next = closestEligibleRider(job.lat, job.lng, job.declinedBy);
      return sendJSON(res, 200, { success: true, offeredToNext: !!next });
    } catch (e) {
      return sendJSON(res, 400, { error: 'Invalid JSON' });
    }
  }

  const riderSubMatch = pathname.match(/^\/api\/riders\/([^/]+)\/subscribe$/);
  if (riderSubMatch && method === 'POST') {
    try {
      const body = await readBody(req);
      const rider = riders.find(r => r.id === riderSubMatch[1]);
      if (!rider) return sendJSON(res, 404, { error: 'Rider not found' });
      if (!body.txid || !body.mmgPhone) {
        return sendJSON(res, 400, { error: 'mmgPhone and txid required' });
      }
      const paidUntil = new Date();
      paidUntil.setDate(paidUntil.getDate() + 30);
      rider.plan = 'paid';
      rider.paidUntil = paidUntil.toISOString();
      persistRiders();
      // In production: verify the transaction with the MMG merchant API first.
      return sendJSON(res, 201, {
        success: true,
        plan: 'paid',
        paidUntil: rider.paidUntil,
        jobCap: riderJobCap(rider),
        amount: body.amount || RIDER_SUB_FEE_GYD
      });
    } catch (e) {
      return sendJSON(res, 400, { error: 'Invalid JSON' });
    }
  }

  const riderPhotoMatch = pathname.match(/^\/api\/riders\/([^/]+)\/photo$/);
  if (riderPhotoMatch && method === 'POST') {
    try {
      const body = await readBody(req);
      const rider = riders.find(r => r.id === riderPhotoMatch[1]);
      if (!rider) return sendJSON(res, 404, { error: 'Rider not found' });
      if (!body.photo) return sendJSON(res, 400, { error: 'photo required' });
      rider.photo = saveRiderPhoto(rider.id, body.photo);
      persistRiders();
      return sendJSON(res, 200, { success: true, photo: rider.photo });
    } catch (e) {
      return sendJSON(res, 400, { error: 'Invalid request' });
    }
  }

  const locMatch = pathname.match(/^\/api\/riders\/([^/]+)\/location$/);
  if (locMatch && method === 'GET') {
    const rider = riders.find(r => r.id === locMatch[1]);
    if (!rider) return sendJSON(res, 404, { error: 'Rider not found' });
    return sendJSON(res, 200, { id: rider.id, lat: rider.lat, lng: rider.lng, online: rider.online, name: rider.name });
  }
  if (locMatch && method === 'POST') {
    try {
      const body = await readBody(req);
      const rider = riders.find(r => r.id === locMatch[1]);
      if (!rider) return sendJSON(res, 404, { error: 'Rider not found' });
      if (typeof body.lat === 'number') rider.lat = body.lat;
      if (typeof body.lng === 'number') rider.lng = body.lng;
      if (typeof body.online === 'boolean') rider.online = body.online;
      persistRiders();
      return sendJSON(res, 200, { id: rider.id, lat: rider.lat, lng: rider.lng, online: rider.online });
    } catch (e) {
      return sendJSON(res, 400, { error: 'Invalid JSON' });
    }
  }

  // Ratings
  if (pathname === '/api/ratings' && method === 'POST') {
    try {
      const body = await readBody(req);
      const { riderId, orderId, stars, comment } = body;
      if (!riderId || !stars || stars < 1 || stars > 5) {
        return sendJSON(res, 400, { error: 'riderId and stars (1–5) required' });
      }
      const rider = riders.find(r => r.id === riderId);
      if (!rider) return sendJSON(res, 404, { error: 'Rider not found' });
      const oldTotal = rider.rating * rider.ratingCount;
      rider.ratingCount += 1;
      rider.rating = Math.round(((oldTotal + stars) / rider.ratingCount) * 10) / 10;
      persistRiders();
      const rating = {
        id: uuid(), riderId, orderId: orderId || null,
        stars, comment: comment || '', createdAt: new Date().toISOString()
      };
      ratings.push(rating);
      persistRatings();
      return sendJSON(res, 201, {
        success: true, rating,
        rider: { id: rider.id, name: rider.name, rating: rider.rating, ratingCount: rider.ratingCount }
      });
    } catch (e) {
      return sendJSON(res, 400, { error: 'Invalid JSON' });
    }
  }

  if (pathname === '/api/ratings' && method === 'GET') {
    return sendJSON(res, 200, ratings);
  }

  // Business — real per-business aggregation, scoped by businessId (preferred)
  // or business name (legacy fallback). Previously this returned a hardcoded
  // all-zero placeholder and 5 orders from EVERY business mixed together —
  // any two businesses would have seen each other's orders/revenue here.
  if (pathname === '/api/business/dashboard' && method === 'GET') {
    let business = null;
    if (query.businessId) business = users.find(u => u.id === query.businessId && u.role === 'business');
    else if (query.business) business = users.find(u => u.role === 'business' && u.businessName === query.business);
    if (!business) {
      return sendJSON(res, 200, { ...businessStats, recentOrders: [] });
    }
    const myDeals = deals.filter(d => d.businessId === business.id);
    const activeDeals = myDeals.filter(d => !d._paused).length;
    const myOrders = orders.filter(o => Array.isArray(o.items) && o.items.some(i => i.businessId === business.id));
    const now = Date.now();
    const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
    const myItemTotal = o => o.items
      .filter(i => i.businessId === business.id)
      .reduce((s, i) => s + (Number(i.price) || 0) * (Number(i.qty) || 0), 0);
    const weekSales = myOrders
      .filter(o => now - new Date(o.createdAt).getTime() <= WEEK_MS)
      .reduce((sum, o) => sum + myItemTotal(o), 0);
    const netPayout = Math.round(weekSales * 0.93); // 7% platform commission — matches the settlement panel copy
    const recentOrders = myOrders.slice(0, 5).map(o => ({
      id: o.id, status: o.status, total: myItemTotal(o), createdAt: o.createdAt
    }));
    return sendJSON(res, 200, {
      name: business.businessName || '',
      plan: businessIsPaid(business) ? 'paid' : 'free',
      paidUntil: business.paidUntil || null,
      weekSales,
      orders: myOrders.length,
      activeDeals,
      netPayout,
      // Listings counted against the free/paid monthly quota — a rolling
      // 30-day window, NOT the lifetime total (that's activeDeals above),
      // so this correctly drops back to 0 a month after the last listing.
      listingsUsed: businessDealCount(business.id),
      listingLimit: businessListingLimit(business),
      recentOrders
    });
  }



  if (pathname === '/api/auth/forgot-password' && method === 'POST') {
    try {
      const body = await readBody(req);
      const email = (body.email || '').trim().toLowerCase();
      if (!isEmail(email)) return sendJSON(res, 400, { error: 'Valid email required' });
      const user = users.find(u => u.email && u.email.toLowerCase() === email);
      // Always return success shape to avoid email enumeration
      if (!user) {
        return sendJSON(res, 200, { success: true, emailSent: false });
      }
      const code = String(Math.floor(100000 + Math.random() * 900000));
      passwordResetTokens.set(email, { code, exp: Date.now() + 30 * 60 * 1000 });
      const mail = await sendEmail({
        to: email,
        subject: 'The Gift Shop password reset code',
        text: 'Your password reset code is: ' + code + '\n\nIt expires in 30 minutes.\n\nIf you did not request this, ignore this email.\n— The Gift Shop',
        html: '<p>Your password reset code is:</p><p style="font-size:24px;font-weight:700;letter-spacing:4px">' + code + '</p><p>Expires in 30 minutes.</p><p>— The Gift Shop</p>'
      });
      const payload = {
        success: true,
        emailSent: !!(mail && mail.sent),
        emailQueued: !!(mail && mail.queued)
      };
      // When email is only queued (no API key), return code so testing still works
      if (!payload.emailSent) payload.devCode = code;
      return sendJSON(res, 200, payload);
    } catch (e) {
      return sendJSON(res, 400, { error: 'Invalid request' });
    }
  }

  if (pathname === '/api/auth/reset-password' && method === 'POST') {
    try {
      const body = await readBody(req);
      const email = (body.email || '').trim().toLowerCase();
      const code = String(body.code || '').trim();
      const password = body.password || '';
      if (!isEmail(email) || !code || password.length < 6) {
        return sendJSON(res, 400, { error: 'Email, code, and new password (min 6) required' });
      }
      const token = passwordResetTokens.get(email);
      if (!token || token.code !== code || Date.now() > token.exp) {
        return sendJSON(res, 400, { error: 'Invalid or expired reset code' });
      }
      const user = users.find(u => u.email && u.email.toLowerCase() === email);
      if (!user) return sendJSON(res, 404, { error: 'Account not found' });
      user.password = hashPassword(password);
      persistUsers();
      passwordResetTokens.delete(email);
      await sendEmail({
        to: email,
        subject: 'Your The Gift Shop password was updated',
        text: 'Your password was changed successfully. If this was not you, contact support immediately.\n— The Gift Shop',
        html: '<p>Your password was changed successfully.</p><p>If this was not you, contact support immediately.</p><p>— The Gift Shop</p>'
      });
      return sendJSON(res, 200, { success: true });
    } catch (e) {
      return sendJSON(res, 400, { error: 'Invalid request' });
    }
  }

  // Auth
  if (pathname === '/api/auth/login' && method === 'POST') {
    try {
      const body = await readBody(req);
      const id = (body.identifier || '').trim().toLowerCase();
      const password = body.password || '';

      // Manager portal: ONLY raulkc / tiromini
      if (body.role === 'manager') {
        if (id === MANAGER_USERNAME.toLowerCase() && password === MANAGER_PASSWORD) {
          return sendJSON(res, 200, {
            success: true,
            user: { id: 'MGR-OWNER', identifier: MANAGER_USERNAME, name: 'Platform Manager', role: 'manager' }
          });
        }
        return sendJSON(res, 403, { error: 'Access denied. Invalid manager credentials.' });
      }

      // Prefer match by role when the app sends one (customer / business / delivery)
      const candidates = users.filter(u =>
        (u.identifier && u.identifier.toLowerCase() === id) ||
        (u.email && u.email.toLowerCase() === id) ||
        (u.phone && u.phone.replace(/\s|-/g, '') === id.replace(/\s|-/g, ''))
      );
      let user = null;
      if (body.role) {
        user = candidates.find(u => u.role === body.role && verifyPassword(password, u.password));
        if (!user && candidates.length) {
          const wrongRole = candidates.find(u => verifyPassword(password, u.password));
          if (wrongRole) {
            return sendJSON(res, 403, {
              error: 'This email is registered as ' + wrongRole.role +
                '. Go back and open the ' + wrongRole.role + ' portal, or create a ' + body.role + ' account with this email.'
            });
          }
        }
      } else {
        user = candidates.find(u => verifyPassword(password, u.password));
      }
      if (!user) {
        return sendJSON(res, 401, { error: 'Invalid email/phone or password' });
      }
      if (user.role === 'manager') {
        return sendJSON(res, 403, { error: 'Access denied' });
      }
      // Legacy accounts created before password hashing was added still have
      // a plain-text password on file — upgrade it silently now that we know
      // it's correct, so it's hashed at rest from this point on.
      if (!isHashedPassword(user.password)) {
        user.password = hashPassword(password);
        persistUsers();
      }
      return sendJSON(res, 200, { success: true, user: publicUser(user) });
    } catch (e) {
      return sendJSON(res, 400, { error: 'Invalid JSON' });
    }
  }

  if (pathname === '/api/auth/register' && method === 'POST') {
    try {
      const body = await readBody(req);
      const name = (body.name || '').trim();
      const password = body.password || '';
      const role = body.role || 'customer';
      if (role === 'manager') {
        return sendJSON(res, 403, { error: 'Manager accounts cannot be registered' });
      }
      const email = (body.email || (body.identifier && String(body.identifier).includes('@') ? body.identifier : '') || '').trim().toLowerCase();
      const phone = (body.phone || '').trim();
      const identifier = (body.identifier || email || phone).trim();

      if (!name || !password || password.length < 6) {
        return sendJSON(res, 400, { error: 'Name and password (min 6 characters) required' });
      }
      if (!isEmail(email)) {
        return sendJSON(res, 400, { error: 'A valid email is required — we send your login details there for safekeeping' });
      }
      if (role === 'business' && !(body.businessName || '').trim()) {
        return sendJSON(res, 400, { error: 'Business name required' });
      }
      // Same email may register once per role (customer / business / delivery)
      if (users.find(u =>
        u.role === role && (
          (u.email && u.email.toLowerCase() === email) ||
          (u.identifier && u.identifier.toLowerCase() === identifier.toLowerCase())
        )
      )) {
        return sendJSON(res, 409, {
          error: 'An account with this email already exists for this role — please sign in'
        });
      }

      const user = {
        id: 'U' + uuid(),
        identifier: email,
        password: hashPassword(password),
        name,
        role,
        phone: phone || '',
        email,
        businessName: body.businessName || null,
        address: body.address || null,
        riderId: role === 'delivery' ? 'R' + uuid().slice(0, 4) : null,
        // Businesses start on the free plan — 1 free listing, more require
        // the paid monthly plan (see FREE_LISTING_LIMIT / businessIsPaid).
        plan: role === 'business' ? 'free' : null,
        paidUntil: null,
        createdAt: new Date().toISOString()
      };
      users.push(user);
      persistUsers();
      if (role === 'delivery') {
        riders.push({
          id: user.riderId || user.id,
          name: user.name,
          phone: user.phone || '',
          rating: 5,
          ratingCount: 0,
          online: true,
          lat: 6.8013,
          lng: -58.1551,
          plan: 'free',
          paidUntil: null,
          photo: null
        });
        persistRiders();
      }

      const roleLabel = role === 'business' ? 'Business' : role === 'delivery' ? 'Delivery partner' : role === 'manager' ? 'Manager' : 'Customer';
      const mailText =
        'Welcome to The Gift Shop, ' + name + '!\n\n' +
        'Your account was created successfully. Keep this email for your records.\n\n' +
        'Role: ' + roleLabel + '\n' +
        'Login email: ' + email + '\n' +
        (phone ? 'Phone: ' + phone + '\n' : '') +
        (user.businessName ? 'Business: ' + user.businessName + '\n' : '') +
        'Password: ' + password + '\n\n' +
        'Sign in any time at The Gift Shop app with your email and password.\n' +
        'Forgot your password later? Use Forgot password on the sign-in screen.\n\n' +
        '— The Gift Shop (Guyana)\n';

      const mailResult = await sendEmail({
        to: email,
        subject: 'Your The Gift Shop login details',
        text: mailText,
        html: '<p>Welcome to <strong>The Gift Shop</strong>, ' + name + '!</p>' +
          '<p>Your account was created. Keep this email for safekeeping.</p>' +
          '<ul><li><strong>Role:</strong> ' + roleLabel + '</li>' +
          '<li><strong>Login email:</strong> ' + email + '</li>' +
          (phone ? '<li><strong>Phone:</strong> ' + phone + '</li>' : '') +
          (user.businessName ? '<li><strong>Business:</strong> ' + user.businessName + '</li>' : '') +
          '<li><strong>Password:</strong> ' + password + '</li></ul>' +
          '<p>Sign in with your email and password. Use <em>Forgot password</em> on the sign-in screen if you need to reset later.</p>' +
          '<p>— The Gift Shop (Guyana)</p>'
      });

      return sendJSON(res, 201, {
        success: true,
        user: publicUser(user),
        emailSent: !!(mailResult && mailResult.sent),
        emailQueued: !!(mailResult && mailResult.queued)
      });
    } catch (e) {
      console.error(e);
      return sendJSON(res, 400, { error: 'Invalid JSON' });
    }
  }

  // Proof of delivery — store + optional email to customer
  if (pathname === '/api/proofs' && method === 'POST') {
    try {
      const body = await readBody(req);
      if (!body.photoDataUrl) return sendJSON(res, 400, { error: 'photoDataUrl required' });
      const id = 'POD-' + uuid();
      let photoUrl = null;
      // Save image file if data URL
      if (String(body.photoDataUrl).startsWith('data:image')) {
        const m = body.photoDataUrl.match(/^data:(image\/\w+);base64,(.+)$/);
        if (m) {
          const ext = m[1].split('/')[1] === 'jpeg' ? 'jpg' : m[1].split('/')[1];
          const fname = id + '.' + ext;
          const fpath = path.join(DATA_DIR, 'proofs', fname);
          fs.writeFileSync(fpath, Buffer.from(m[2], 'base64'));
          photoUrl = '/data/proofs/' + fname;
        }
      }
      const proof = {
        id,
        orderId: body.orderId || null,
        riderId: body.riderId || null,
        riderName: body.riderName || null,
        customerEmail: body.customerEmail || null,
        customerName: body.customerName || null,
        address: body.address || null,
        notes: body.notes || '',
        photoUrl,
        // keep small reference only in index; full image on disk
        deliveredAt: body.deliveredAt || new Date().toISOString(),
        createdAt: new Date().toISOString()
      };
      deliveryProofs.unshift(proof);
      if (deliveryProofs.length > 500) deliveryProofs = deliveryProofs.slice(0, 500);
      persistProofs();

      let emailSent = false;
      if (isEmail(body.customerEmail)) {
        const attachments = [];
        if (photoUrl) {
          const fpath = path.join(ROOT, photoUrl.replace(/^\//, ''));
          if (fs.existsSync(fpath)) {
            attachments.push({
              filename: 'proof-of-delivery.jpg',
              contentType: 'image/jpeg',
              contentBase64: fs.readFileSync(fpath).toString('base64')
            });
          }
        }
        const mail = await sendEmail({
          to: body.customerEmail,
          subject: 'Delivery proof — The Gift Shop order ' + (body.orderId || ''),
          text: 'Your order was delivered.\n\nOrder: ' + (body.orderId || '') +
            '\nAddress: ' + (body.address || '') +
            '\nRider: ' + (body.riderName || '') +
            (body.notes ? '\nNotes: ' + body.notes : '') +
            '\n\nProof of delivery photo is attached when email delivery is configured.\n— The Gift Shop',
          html: '<p>Your order was <strong>delivered</strong>.</p>' +
            '<p>Order: ' + (body.orderId || '') + '<br>Address: ' + (body.address || '') +
            '<br>Rider: ' + (body.riderName || '') + '</p>' +
            (body.notes ? '<p>Notes: ' + body.notes + '</p>' : '') +
            '<p>— The Gift Shop (Guyana)</p>',
          attachments
        });
        emailSent = !!(mail && mail.sent);
        proof.emailSent = emailSent;
        proof.emailQueued = !!(mail && mail.queued);
        persistProofs();
      }

      return sendJSON(res, 201, { success: true, proof, emailSent });
    } catch (e) {
      console.error(e);
      return sendJSON(res, 400, { error: 'Invalid request' });
    }
  }

  if (pathname === '/api/proofs' && method === 'GET') {
    const riderId = query.riderId;
    let list = deliveryProofs;
    if (riderId) list = list.filter(p => p.riderId === riderId);
    // include photo as path; client loads URL
    return sendJSON(res, 200, {
      proofs: list.map(p => ({
        ...p,
        photo: p.photoUrl // alias for UI
      }))
    });
  }


  if (pathname === '/api/business/subscribe' && method === 'POST') {
    try {
      const body = await readBody(req);
      if (!body.txid || !body.mmgPhone) {
        return sendJSON(res, 400, { error: 'mmgPhone and txid required' });
      }
      const paidUntil = new Date();
      paidUntil.setDate(paidUntil.getDate() + 30);
      const record = {
        amount: body.amount || BUSINESS_SUB_FEE_GYD,
        mmgTo: body.mmgTo || '61214940',
        mmgPhone: body.mmgPhone,
        txid: body.txid,
        reference: body.reference || null,
        paidUntil: paidUntil.toISOString(),
        createdAt: new Date().toISOString()
      };
      // In production: verify with MMG API first. Attach the paid plan to
      // the real business account so the free-listing limit actually lifts
      // (previously this was a no-op — the payment was logged but never
      // reached the account, so the free-listing gate never lifted).
      let business = null;
      if (body.businessId) {
        business = users.find(u => u.id === body.businessId && u.role === 'business');
        if (business) {
          business.plan = 'paid';
          business.paidUntil = record.paidUntil;
          persistUsers();
        }
      }
      return sendJSON(res, 201, {
        success: true, subscription: record, plan: 'paid',
        attached: !!business,
        listingLimit: business ? businessListingLimit(business) : PAID_LISTING_LIMIT
      });
    } catch (e) {
      return sendJSON(res, 400, { error: 'Invalid JSON' });
    }
  }

  // Platform ads (manager-created, free — shown on login/customer/business/rider
  // screens). Client-side gates the "New Ad" control to the manager UI only;
  // there's no session/auth-token system in this prototype for the server to
  // check who's calling, same as the rest of this app's endpoints.
  if (pathname === '/api/ads' && method === 'GET') {
    sweepExpiredAds();
    return sendJSON(res, 200, { ads: platformAds });
  }
  // Customer-purchased ad placement — paid in full (MMG) before it goes live.
  // GYD 1,000/day, 3-day minimum, or GYD 5,000 flat for the 7-day package.
  if (pathname === '/api/ads/customer' && method === 'POST') {
    try {
      const body = await readBody(req);
      if (!body.headline) return sendJSON(res, 400, { error: 'headline required' });
      if (!body.txid || !body.mmgPhone) {
        return sendJSON(res, 400, { error: 'mmgPhone and txid required — pay via MMG 61214940 first' });
      }
      const days = Math.max(CUSTOMER_AD_MIN_DAYS, Math.floor(Number(body.days) || CUSTOMER_AD_MIN_DAYS));
      const amount = customerAdCost(days);
      const now = new Date();
      const expires = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
      const adId = 'CAD' + uuid();
      const ad = {
        id: adId,
        headline: body.headline,
        sub: body.sub || '',
        place: body.place || 'all',
        status: 'Active',
        source: 'customer',
        customerId: body.customerId || null,
        customerName: body.customerName || 'Customer',
        days,
        amount,
        photo: saveAdPhoto(adId, body.photo),
        mmgPhone: body.mmgPhone,
        txid: body.txid,
        startsAt: now.toISOString(),
        expiresAt: expires.toISOString(),
        createdAt: now.toISOString()
      };
      platformAds.unshift(ad);
      persistAds();
      // In production: verify the transaction with the MMG merchant API first.
      return sendJSON(res, 201, { success: true, ad, amount, days });
    } catch (e) {
      return sendJSON(res, 400, { error: 'Invalid JSON' });
    }
  }
  if (pathname === '/api/ads' && method === 'POST') {
    try {
      const body = await readBody(req);
      if (!body.headline) return sendJSON(res, 400, { error: 'headline required' });
      const id = body.id || ('AD' + Date.now().toString(36).toUpperCase());
      const existing = platformAds.find(a => a.id === id);
      const ad = {
        id,
        headline: body.headline,
        sub: body.sub || '',
        place: body.place || 'all', // login | customer | business | rider | all | (legacy) both
        status: body.status || 'Active',
        photo: saveAdPhoto(id, body.photo)
      };
      if (existing) Object.assign(existing, ad); else platformAds.unshift(ad);
      persistAds();
      return sendJSON(res, 201, { success: true, ad: existing || ad });
    } catch (e) {
      return sendJSON(res, 400, { error: 'Invalid JSON' });
    }
  }
  const adMatch = pathname.match(/^\/api\/ads\/([^/]+)$/);
  if (adMatch && method === 'DELETE') {
    const before = platformAds.length;
    platformAds = platformAds.filter(a => a.id !== adMatch[1]);
    if (platformAds.length === before) return sendJSON(res, 404, { error: 'Ad not found' });
    persistAds();
    return sendJSON(res, 200, { success: true });
  }


  if (pathname === '/api/admin/activity' && method === 'GET') {
    return sendJSON(res, 200, {
      users: users.map(publicUser),
      deals,
      orders,
      availableJobs,
      proofs: deliveryProofs.slice(0, 50),
      counts: {
        businesses: users.filter(u => u.role === 'business').length,
        customers: users.filter(u => u.role === 'customer').length,
        riders: users.filter(u => u.role === 'delivery').length,
        deals: deals.length,
        orders: orders.length
      }
    });
  }

  
  if (pathname === '/api/admin/backup' && method === 'GET') {
    return sendJSON(res, 200, {
      exportedAt: new Date().toISOString(),
      users: users.map(u => ({ ...u, password: '***' })), // passwords redacted in export view
      usersFull: users, // full restore payload for server admins only
      deals,
      jobs: availableJobs,
      orders,
      proofs: deliveryProofs,
      riders,
      ratings
    });
  }

  if (pathname === '/api/admin/restore' && method === 'POST') {
    try {
      const body = await readBody(req);
      if (body.usersFull && Array.isArray(body.usersFull)) { users = body.usersFull; persistUsers(); }
      else if (body.users && Array.isArray(body.users)) { users = body.users; persistUsers(); }
      if (body.deals && Array.isArray(body.deals)) { deals = body.deals; persistDeals(); }
      if (body.jobs && Array.isArray(body.jobs)) { availableJobs = body.jobs; persistJobs(); }
      if (body.orders && Array.isArray(body.orders)) { orders.length = 0; body.orders.forEach(x => orders.push(x)); persistOrders(); }
      if (body.riders && Array.isArray(body.riders)) { riders = body.riders; persistRiders(); }
      if (body.ratings && Array.isArray(body.ratings)) { ratings.length = 0; body.ratings.forEach(x => ratings.push(x)); persistRatings(); }
      return sendJSON(res, 200, { success: true, counts: { users: users.length, deals: deals.length, riders: riders.length } });
    } catch (e) {
      return sendJSON(res, 400, { error: 'Restore failed' });
    }
  }

  // Self-service profile edit — customers, businesses, and riders can update
  // their own name/phone/address (and business name, for a business). Does
  // NOT change email/identifier (that's the login key — changing it safely
  // needs its own verification flow) or password (use forgot/reset-password
  // for that). Riders also get their matching `riders` directory entry kept
  // in sync, since that's the copy used for public listing/dispatch.
  const userEditMatch = pathname.match(/^\/api\/users\/([^/]+)$/);
  if (userEditMatch && method === 'PATCH') {
    try {
      const body = await readBody(req);
      const user = users.find(u => u.id === userEditMatch[1]);
      if (!user) return sendJSON(res, 404, { error: 'Account not found' });
      if (user.role === 'manager') return sendJSON(res, 403, { error: 'Manager profile cannot be edited here' });

      if (body.name !== undefined) {
        const name = String(body.name).trim();
        if (!name) return sendJSON(res, 400, { error: 'Name cannot be empty' });
        user.name = name;
      }
      if (body.phone !== undefined) user.phone = String(body.phone).trim();
      if (body.address !== undefined) user.address = String(body.address).trim() || null;
      if (user.role === 'business' && body.businessName !== undefined) {
        const bn = String(body.businessName).trim();
        if (!bn) return sendJSON(res, 400, { error: 'Business name cannot be empty' });
        user.businessName = bn;
      }
      persistUsers();

      // Keep the rider directory (separate collection, used for public
      // listings/dispatch matching) in sync with the account's own name/phone.
      if (user.role === 'delivery' && user.riderId) {
        const rider = riders.find(r => r.id === user.riderId);
        if (rider) {
          if (body.name !== undefined) rider.name = user.name;
          if (body.phone !== undefined) rider.phone = user.phone;
          persistRiders();
        }
      }
      // Existing listings keep showing the business's old name until edited —
      // refresh them so a rename shows up everywhere immediately.
      if (user.role === 'business' && body.businessName !== undefined) {
        let changed = false;
        deals.forEach(d => { if (d.businessId === user.id) { d.business = user.businessName; changed = true; } });
        if (changed) persistDeals();
      }

      return sendJSON(res, 200, { success: true, user: publicUser(user) });
    } catch (e) {
      return sendJSON(res, 400, { error: 'Invalid JSON' });
    }
  }

if (pathname === '/api/admin/users' && method === 'GET') {
    return sendJSON(res, 200, { success: true, users: users.map(u => publicUser(u)) });
  }
  if (pathname === '/api/admin/users' && method === 'POST') {
    try {
      const body = await readBody(req);
      if (!body.identifier || !body.name || !body.role) {
        return sendJSON(res, 400, { error: 'name, identifier, role required' });
      }
      const user = {
        id: 'U' + uuid(),
        identifier: body.identifier,
        password: hashPassword(body.password || 'giftshop'),
        name: body.name,
        role: body.role,
        phone: body.phone || (body.identifier.includes('@') ? '' : body.identifier),
        email: body.email || (body.identifier.includes('@') ? body.identifier : ''),
        businessName: body.businessName || null,
        plan: body.role === 'business' ? 'free' : null,
        paidUntil: null
      };
      users.push(user);
      persistUsers();
      return sendJSON(res, 201, { success: true, user: publicUser(user) });
    } catch (e) {
      return sendJSON(res, 400, { error: 'Invalid JSON' });
    }
  }
  if (pathname.match(/^\/api\/admin\/users\/[^/]+$/) && method === 'DELETE') {
    const id = pathname.split('/').pop();
    const idx = users.findIndex(u => u.id === id);
    if (idx < 0) return sendJSON(res, 404, { error: 'Not found' });
    if (users[idx].role === 'manager') return sendJSON(res, 403, { error: 'Cannot delete manager' });
    users.splice(idx, 1);
    return sendJSON(res, 200, { success: true });
  }

  return sendJSON(res, 404, { error: 'API route not found', path: pathname });
}

// ─── Server ────────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url, `http://${req.headers.host}`);
    const pathname = decodeURIComponent(u.pathname);
    const query = Object.fromEntries(u.searchParams);

    if (pathname.startsWith('/api')) {
      return await handleAPI(req, res, pathname, query);
    }
    return serveStatic(req, res, pathname);
  } catch (err) {
    console.error(err);
    sendJSON(res, 500, { error: 'Server error' });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  const os = require('os');
  const nets = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) ips.push(net.address);
    }
  }
  console.log('');
  console.log('  🎁  The Gift Shop backend is LIVE');
  console.log('  ─────────────────────────────────');
  console.log(`  Local:   http://localhost:${PORT}`);
  ips.forEach(ip => console.log(`  Phone:   http://${ip}:${PORT}`));
  if (!ips.length) console.log('  Phone:   http://<your-computer-IP>:3000');
  console.log('');
  console.log('  Same Wi‑Fi as your phone → open the Phone URL above.');
  console.log('  API health: /api/health');
  console.log('');
});
