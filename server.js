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

// ─── Data store ────────────────────────────────────────────────────────────
let deals = [];


let riders = [];


const orders = [];
const ratings = [];
let availableJobs = [];



// Persistent storage (users + delivery proofs)
const DATA_DIR = path.join(ROOT, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const PROOFS_FILE = path.join(DATA_DIR, 'proofs.json');
const OUTBOX_DIR = path.join(DATA_DIR, 'outbox');

function ensureDataDirs() {
  [DATA_DIR, OUTBOX_DIR, path.join(DATA_DIR, 'proofs')].forEach(d => {
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
const passwordResetTokens = new Map(); // email -> { code, exp }

function persistUsers() { saveJSON(USERS_FILE, users); }
function persistProofs() { saveJSON(PROOFS_FILE, deliveryProofs); }

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
  // Allow serving stored proof images
  let filePath = path.join(ROOT, pathname === '/' ? 'index.html' : pathname);
  // Prevent path traversal
  if (!filePath.startsWith(ROOT)) {
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
    let list = deals;
    if (query.category && query.category !== 'all') {
      list = deals.filter(d => d.category === query.category);
    }
    return sendJSON(res, 200, list);
  }


  if (pathname === '/api/deals' && method === 'POST') {
    try {
      const body = await readBody(req);
      if (!body.title || !body.price) {
        return sendJSON(res, 400, { error: 'title and price required' });
      }
      const deal = {
        id: deals.length ? Math.max(...deals.map(d => d.id)) + 1 : 1,
        business: body.business || 'Local Business',
        title: body.title,
        price: Number(body.price),
        original: Number(body.original) || Number(body.price),
        discount: body.discount || 0,
        category: body.category || 'food',
        emoji: body.emoji || '🎁',
        description: body.description || body.title,
        daysLeft: body.daysLeft || 5,
        distance: body.distance || '1.0 km',
        delivery: body.delivery !== false
      };
      deals.unshift(deal);
      return sendJSON(res, 201, { success: true, deal });
    } catch (e) {
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
      const { items, fulfillment, paymentMethod, deliveryAddress, deliveryPhone, deliveryNotes, mmgPhone, subtotal, deliveryFee } = body;
      if (!items || !items.length) return sendJSON(res, 400, { error: 'Cart is empty' });
      if (fulfillment === 'delivery' && (!deliveryAddress || !deliveryPhone)) {
        return sendJSON(res, 400, { error: 'Delivery address and contact number required' });
      }
      const online = riders.filter(r => r.online);
      const rider = online[Math.floor(Math.random() * online.length)] || riders[0];
      const order = {
        id: 'ORD-' + uuid(),
        items,
        fulfillment: fulfillment || 'pickup',
        paymentMethod: paymentMethod || 'cod',
        deliveryAddress: deliveryAddress || null,
        deliveryPhone: deliveryPhone || null,
        deliveryNotes: deliveryNotes || '',
        mmgPhone: mmgPhone || null,
        subtotal: subtotal || items.reduce((s, i) => s + i.price * i.qty, 0),
        deliveryFee: deliveryFee || 0,
        status: 'confirmed',
        rider: fulfillment === 'delivery' ? {
          id: rider.id, name: rider.name, phone: rider.phone,
          rating: rider.rating, ratingCount: rider.ratingCount,
          avatar: rider.avatar, lat: rider.lat, lng: rider.lng
        } : null,
        createdAt: new Date().toISOString(),
        podPhoto: null, podNotes: null
      };
      order.total = order.subtotal + order.deliveryFee;
      orders.unshift(order);
      return sendJSON(res, 201, {
        success: true, order,
        message: fulfillment === 'delivery'
          ? 'Order placed! A rider will pick it up soon.'
          : 'Order placed! Show your voucher in-store.'
      });
    } catch (e) {
      return sendJSON(res, 400, { error: 'Invalid JSON body' });
    }
  }

  const orderMatch = pathname.match(/^\/api\/orders\/([^/]+)$/);
  if (orderMatch && method === 'GET') {
    const order = orders.find(o => o.id === orderMatch[1]);
    if (!order) return sendJSON(res, 404, { error: 'Order not found' });
    return sendJSON(res, 200, order);
  }

  const orderStatusMatch = pathname.match(/^\/api\/orders\/([^/]+)\/status$/);
  if (orderStatusMatch && method === 'PATCH') {
    try {
      const body = await readBody(req);
      const order = orders.find(o => o.id === orderStatusMatch[1]);
      if (!order) return sendJSON(res, 404, { error: 'Order not found' });
      if (body.status) order.status = body.status;
      if (body.podPhoto) order.podPhoto = body.podPhoto;
      if (body.podNotes !== undefined) order.podNotes = body.podNotes;
      if (body.status === 'delivered') order.deliveredAt = new Date().toISOString();
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
      avatar: r.avatar, online: r.online
    })));
  }

  if (pathname === '/api/riders/jobs' && method === 'GET') {
    return sendJSON(res, 200, availableJobs);
  }

  const acceptMatch = pathname.match(/^\/api\/riders\/jobs\/([^/]+)\/accept$/);
  if (acceptMatch && method === 'POST') {
    try {
      const body = await readBody(req);
      const idx = availableJobs.findIndex(j => j.id === acceptMatch[1]);
      if (idx === -1) return sendJSON(res, 404, { error: 'Job not found' });
      const job = availableJobs.splice(idx, 1)[0];
      const rider = riders.find(r => r.id === (body.riderId || 'R1')) || riders[0];
      return sendJSON(res, 200, {
        success: true,
        job: { ...job, status: 'active', rider: { id: rider.id, name: rider.name, phone: rider.phone } }
      });
    } catch (e) {
      return sendJSON(res, 400, { error: 'Invalid JSON' });
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
      const rating = {
        id: uuid(), riderId, orderId: orderId || null,
        stars, comment: comment || '', createdAt: new Date().toISOString()
      };
      ratings.push(rating);
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

  // Business
  if (pathname === '/api/business/dashboard' && method === 'GET') {
    return sendJSON(res, 200, { ...businessStats, recentOrders: orders.slice(0, 5) });
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
      user.password = password;
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
        user = candidates.find(u => u.role === body.role && u.password === password);
        if (!user && candidates.length) {
          const wrongRole = candidates.find(u => u.password === password);
          if (wrongRole) {
            return sendJSON(res, 403, {
              error: 'This email is registered as ' + wrongRole.role +
                '. Go back and open the ' + wrongRole.role + ' portal, or create a ' + body.role + ' account with this email.'
            });
          }
        }
      } else {
        user = candidates.find(u => u.password === password);
      }
      if (!user) {
        return sendJSON(res, 401, { error: 'Invalid email/phone or password' });
      }
      if (user.role === 'manager') {
        return sendJSON(res, 403, { error: 'Access denied' });
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
        password,
        name,
        role,
        phone: phone || '',
        email,
        businessName: body.businessName || null,
        riderId: role === 'delivery' ? 'R' + uuid().slice(0, 4) : null,
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
          lng: -58.1551
        });
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
        amount: body.amount || 5000,
        mmgTo: body.mmgTo || '6124940',
        mmgPhone: body.mmgPhone,
        txid: body.txid,
        reference: body.reference || null,
        paidUntil: paidUntil.toISOString(),
        createdAt: new Date().toISOString()
      };
      // In production: verify with MMG API, attach to business account
      return sendJSON(res, 201, { success: true, subscription: record, plan: 'paid' });
    } catch (e) {
      return sendJSON(res, 400, { error: 'Invalid JSON' });
    }
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

  if (pathname === '/api/admin/users' && method === 'GET') {
    return sendJSON(res, 200, users.map(u => publicUser(u)));
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
        password: body.password || 'giftshop',
        name: body.name,
        role: body.role,
        phone: body.phone || (body.identifier.includes('@') ? '' : body.identifier),
        email: body.email || (body.identifier.includes('@') ? body.identifier : ''),
        businessName: body.businessName || null
      };
      users.push(user);
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
