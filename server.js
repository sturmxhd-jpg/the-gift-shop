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
const ROOT = __dirname;

function uuid() {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

// ─── Data store ────────────────────────────────────────────────────────────
const deals = [
  { id: 1, business: 'Island Breeze Restaurant', title: 'Pepperpot + Rice Combo', price: 4800, original: 6500, discount: 26, category: 'food', emoji: '🍲', description: 'Authentic Guyanese pepperpot with fluffy plantain rice. Serves 1–2.', daysLeft: 2, distance: '1.2 km', delivery: true },
  { id: 2, business: 'Craft Plus Too', title: 'Handcrafted Wooden Bowl Set', price: 8500, original: 12000, discount: 29, category: 'gifts', emoji: '🪵', description: 'Set of 3 hand-carved bowls from local greenheart wood.', daysLeft: 5, distance: '0.8 km', delivery: true },
  { id: 3, business: 'Style Avenue', title: 'Linen Shirt – Men’s', price: 5500, original: 8000, discount: 31, category: 'fashion', emoji: '👔', description: 'Breathable linen, perfect for Georgetown heat.', daysLeft: 4, distance: '1.5 km', delivery: true },
  { id: 4, business: 'Guyana Flavours', title: 'Local Spice Gift Box', price: 3900, original: 5200, discount: 25, category: 'gifts', emoji: '🌶️', description: 'Cassareep, wiri wiri, thyme & more – ready to gift.', daysLeft: 7, distance: '2.1 km', delivery: true },
  { id: 5, business: 'Big Kahuna Burger', title: 'Buy 1 Get 1 Free Burgers', price: 1800, original: 3600, discount: 50, category: 'food', emoji: '🍔', description: 'Classic beef burgers. BOGO on Tuesday–Thursday.', daysLeft: 3, distance: '0.9 km', delivery: true },
  { id: 6, business: 'Glow Beauty', title: 'Shea Butter Hair Care Set', price: 4200, original: 6000, discount: 30, category: 'beauty', emoji: '✨', description: 'Natural shea butter shampoo + leave-in conditioner.', daysLeft: 6, distance: '1.8 km', delivery: true },
  { id: 7, business: 'Tropic Wear', title: 'Ankara Print Dress', price: 7500, original: 11000, discount: 32, category: 'fashion', emoji: '👗', description: 'Vibrant Ankara midi dress, sizes S–XL.', daysLeft: 4, distance: '1.3 km', delivery: true },
  { id: 8, business: 'Tropical Sips', title: 'Fresh Coconut Water (6-pack)', price: 1800, original: 2400, discount: 25, category: 'food', emoji: '🥥', description: 'Ice-cold fresh coconut water. Delivered chilled.', daysLeft: 2, distance: '1.0 km', delivery: true }
];

const riders = [
  { id: 'R1', name: 'Marcus D.', phone: '592-671-8801', rating: 4.9, ratingCount: 128, avatar: '🧔', online: true, lat: 6.8013, lng: -58.1551 },
  { id: 'R2', name: 'Aisha K.', phone: '592-624-3390', rating: 4.8, ratingCount: 95, avatar: '👩', online: true, lat: 6.808, lng: -58.162 },
  { id: 'R3', name: 'Ryan P.', phone: '592-612-7742', rating: 5.0, ratingCount: 64, avatar: '👨', online: true, lat: 6.815, lng: -58.148 },
  { id: 'R4', name: 'Keisha B.', phone: '592-645-1128', rating: 4.7, ratingCount: 112, avatar: '👩‍🦱', online: false, lat: 6.795, lng: -58.160 }
];

const orders = [];
const ratings = [];
let availableJobs = [
  { id: 'DEL-441', business: 'Island Breeze', item: 'Pepperpot Combo ×2', address: '12 Lamaha Street, Georgetown', phone: '592-612-3456', customer: 'Aaliyah R.', fee: 550, distance: '2.3 km', lat: 6.812, lng: -58.155 },
  { id: 'DEL-442', business: 'Craft Plus Too', item: 'Wooden Bowl Set', address: 'Hibiscus Craft Plaza, Robbstown', phone: '592-624-8891', customer: 'Kevin M.', fee: 450, distance: '1.1 km', lat: 6.808, lng: -58.162 },
  { id: 'DEL-443', business: 'Guyana Flavours', item: 'Spice Gift Box ×3', address: '45 Sheriff Street, Georgetown', phone: '592-671-2203', customer: 'Sofia T.', fee: 600, distance: '3.4 km', lat: 6.821, lng: -58.149 }
];


const users = [
  { id: 'U1', identifier: '592-612-3456', password: 'giftshop', name: 'Aaliyah Rodrigues', role: 'customer', phone: '592-612-3456', email: 'aaliyah@example.gy' },
  { id: 'U2', identifier: 'island@breeze.gy', password: 'giftshop', name: 'Rohan Persaud', role: 'business', businessName: 'Island Breeze Restaurant', phone: '592-225-1001', email: 'island@breeze.gy' },
  { id: 'U3', identifier: '592-671-8801', password: 'giftshop', name: 'Marcus D.', role: 'delivery', phone: '592-671-8801', email: 'marcus.rider@giftshop.gy', riderId: 'R1' },
  { id: 'U4', identifier: 'admin@giftshop.gy', password: 'giftshop', name: 'Platform Manager', role: 'manager', phone: '592-612-4940', email: 'admin@giftshop.gy' }
];

function publicUser(u) {
  const { password, ...rest } = u;
  return rest;
}

const businessStats = {
  name: 'Island Breeze Restaurant', plan: 'Growth',
  weekSales: 142900, orders: 34, activeDeals: 6, netPayout: 114626
};

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
  let filePath = path.join(ROOT, pathname === '/' ? 'index.html' : pathname);
  // Prevent path traversal
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403); return res.end('Forbidden');
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      // SPA fallback
      if (pathname.startsWith('/api')) {
        return sendJSON(res, 404, { error: 'Not found' });
      }
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


  // Auth
  if (pathname === '/api/auth/login' && method === 'POST') {
    try {
      const body = await readBody(req);
      const id = (body.identifier || '').trim().toLowerCase();
      const password = body.password || '';
      const user = users.find(u => u.identifier.toLowerCase() === id && u.password === password);
      if (!user) return sendJSON(res, 401, { error: 'Invalid phone/email or password' });
      if (body.role && user.role !== body.role) {
        return sendJSON(res, 403, { error: 'This account is registered as ' + user.role });
      }
      return sendJSON(res, 200, { success: true, user: publicUser(user) });
    } catch (e) {
      return sendJSON(res, 400, { error: 'Invalid JSON' });
    }
  }

  if (pathname === '/api/auth/register' && method === 'POST') {
    try {
      const body = await readBody(req);
      const identifier = (body.identifier || '').trim();
      const password = body.password || '';
      const name = (body.name || '').trim();
      const role = body.role || 'customer';
      if (!identifier || !password || !name) {
        return sendJSON(res, 400, { error: 'Name, phone/email and password required' });
      }
      if (users.find(u => u.identifier.toLowerCase() === identifier.toLowerCase())) {
        return sendJSON(res, 409, { error: 'Account already exists — please sign in' });
      }
      const user = {
        id: 'U' + uuid(),
        identifier,
        password,
        name,
        role,
        phone: identifier.includes('@') ? '' : identifier,
        email: identifier.includes('@') ? identifier : '',
        businessName: body.businessName || null,
        riderId: role === 'delivery' ? 'R' + uuid().slice(0, 2) : null
      };
      users.push(user);
      return sendJSON(res, 201, { success: true, user: publicUser(user) });
    } catch (e) {
      return sendJSON(res, 400, { error: 'Invalid JSON' });
    }
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
