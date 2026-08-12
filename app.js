
// ===== Backend API client =====
const API_BASE = (typeof location !== "undefined" && location.origin && !location.origin.startsWith("file"))
  ? location.origin
  : "";

async function api(path, options = {}) {
  // Prefer same origin; fall back to localhost when opened oddly
  const base = API_BASE || (typeof location !== "undefined" && location.protocol && location.protocol !== "file:"
    ? location.origin
    : "http://127.0.0.1:3000");
  try {
    const res = await fetch(base + path, {
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      ...options
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { success: false, error: data.error || res.statusText || "Request failed", status: res.status };
    }
    return data;
  } catch (e) {
    console.warn("API offline or error:", e.message);
    return { success: false, error: e.message || "Network error", offline: true };
  }
}

/** Local account store when server is offline */
function loadLocalUsers() {
  try { return JSON.parse(localStorage.getItem("tgs_local_users") || "[]"); } catch (_) { return []; }
}
function saveLocalUsers(list) {
  try { localStorage.setItem("tgs_local_users", JSON.stringify(list)); } catch (_) {}
}
function registerLocalUser(payload) {
  const list = loadLocalUsers();
  const email = (payload.email || "").toLowerCase();
  const identifier = (payload.identifier || email).toLowerCase();
  if (list.find(u =>
    (u.email && u.email.toLowerCase() === email) ||
    (u.identifier && u.identifier.toLowerCase() === identifier)
  )) {
    return { success: false, error: "Account already exists — please sign in" };
  }
  const user = {
    id: "L" + Date.now(),
    identifier: payload.identifier || email,
    password: payload.password,
    name: payload.name,
    role: payload.role || "customer",
    phone: payload.phone || "",
    email: email,
    businessName: payload.businessName || null,
    riderId: payload.role === "delivery" ? "R" + Date.now().toString(36) : null,
    createdAt: new Date().toISOString()
  };
  list.push(user);
  saveLocalUsers(list);
  const { password, ...pub } = user;
  return { success: true, user: pub, emailSent: false, emailQueued: false, local: true };
}
function loginLocalUser(identifier, password, role) {
  const id = (identifier || "").toLowerCase();
  const list = loadLocalUsers();
  const user = list.find(u =>
    u.password === password && (
      (u.identifier && u.identifier.toLowerCase() === id) ||
      (u.email && u.email.toLowerCase() === id) ||
      (u.phone && u.phone.replace(/\s|-/g, "") === id.replace(/\s|-/g, ""))
    )
  );
  if (!user) return { success: false, error: "Invalid email/phone or password" };
  if (role && user.role !== role) {
    return { success: false, error: "This account is registered as " + user.role };
  }
  const { password: _p, ...pub } = user;
  return { success: true, user: pub, local: true };
}

// ===== SAMPLE DATA =====
const deals = [
  {
    id: 1,
    title: "Pepperpot + Rice Combo",
    business: "Island Breeze Restaurant",
    category: "food",
    original: 6500,
    price: 4800,
    discount: 26,
    emoji: "🍲",
    expires: "2 days left",
    distance: "1.2 km",
    description: "Authentic Guyanese pepperpot with fluffy rice and plantain. Serves 1–2.",
    delivery: true
  },
  {
    id: 2,
    title: "Handcrafted Wooden Bowl Set",
    business: "Craft Plus Too",
    category: "gifts",
    original: 12000,
    price: 8500,
    discount: 29,
    emoji: "🪵",
    expires: "5 days left",
    distance: "0.8 km",
    description: "Set of 3 hand-carved hardwood bowls. Perfect gift or home décor.",
    delivery: true
  },
  {
    id: 3,
    title: "50% Off Manicure + Pedicure",
    business: "Glow Beauty Studio",
    category: "beauty",
    original: 8000,
    price: 4000,
    discount: 50,
    emoji: "💅",
    expires: "Today only",
    distance: "2.1 km",
    description: "Full manicure and pedicure with gel option. Book your slot after purchase.",
    delivery: false
  },
  {
    id: 4,
    title: "Local Spice Gift Box",
    business: "Guyana Flavours",
    category: "gifts",
    original: 5500,
    price: 3900,
    discount: 29,
    emoji: "🌶️",
    expires: "4 days left",
    distance: "1.5 km",
    description: "Cassareep, wiri wiri peppers, thyme & more. Beautifully packaged.",
    delivery: true
  },
  {
    id: 5,
    title: "Buy 1 Get 1 Free Burgers",
    business: "Big Kahuna Burger",
    category: "food",
    original: 3600,
    price: 1800,
    discount: 50,
    emoji: "🍔",
    expires: "3 days left",
    distance: "0.6 km",
    description: "Any classic burger. Second one free. Dine-in or takeaway.",
    delivery: true
  },
  {
    id: 6,
    title: "Summer Dress Collection",
    business: "Trendy Threads GY",
    category: "fashion",
    original: 9000,
    price: 6300,
    discount: 30,
    emoji: "👗",
    expires: "6 days left",
    distance: "1.8 km",
    description: "Select summer dresses – light fabrics perfect for Georgetown heat.",
    delivery: true
  },
  {
    id: 7,
    title: "1-Hour Deep Tissue Massage",
    business: "Serenity Spa",
    category: "services",
    original: 10000,
    price: 7000,
    discount: 30,
    emoji: "💆",
    expires: "7 days left",
    distance: "2.4 km",
    description: "Relaxing deep tissue session with aromatic oils.",
    delivery: false
  },
  {
    id: 8,
    title: "Fresh Coconut Water (6-pack)",
    business: "Tropical Sips",
    category: "food",
    original: 2400,
    price: 1800,
    discount: 25,
    emoji: "🥥",
    expires: "1 day left",
    distance: "0.9 km",
    description: "Ice-cold fresh coconut water. Delivered chilled.",
    delivery: true
  }
];

// Customer live delivery tracking
let customerLiveOrders = [];
try {
  const clo = localStorage.getItem('tgs_live_orders');
  if (clo) customerLiveOrders = JSON.parse(clo);
} catch (_) {}
function saveLiveOrders() {
  try { localStorage.setItem('tgs_live_orders', JSON.stringify(customerLiveOrders)); } catch (_) {}
}

const businessDeals = [
  { id: "BD1", title: "Pepperpot + Rice Combo", price: 4800, original: 6500, status: "Active", redemptions: 23, photo: null, emoji: "🍲", description: "Authentic pepperpot", category: "food", daysLeft: 5 },
  { id: "BD2", title: "Friday Fish Fry Special", price: 3500, original: 4500, status: "Active", redemptions: 11, photo: null, emoji: "🐟", description: "Crispy fried fish", category: "food", daysLeft: 3 },
  { id: "BD3", title: "Family Platter (4 pax)", price: 12000, original: 15000, status: "Active", redemptions: 7, photo: null, emoji: "🍛", description: "Family meal deal", category: "food", daysLeft: 7 },
  { id: "BD4", title: "Cook-up Rice Bowl", price: 2800, original: 3500, status: "Paused", redemptions: 41, photo: null, emoji: "🍚", description: "Classic cook-up", category: "food", daysLeft: 4 }
];
let pendingDealPhoto = null; // data URL for new/edit deal photo
let editingDealId = null;

const incomingOrders = [
  { id: "ORD-8821", item: "Pepperpot Combo ×2", type: "Delivery", total: 9600, status: "Ready", customer: "Aaliyah R." },
  { id: "ORD-8819", item: "Family Platter", type: "Pickup", total: 12000, status: "Preparing", customer: "Kevin M." },
  { id: "ORD-8815", item: "Pepperpot Combo", type: "Delivery", total: 4800, status: "New", customer: "Sofia T." }
];

const riderOrders = [
  { id: "DEL-441", business: "Island Breeze", item: "Pepperpot Combo ×2", address: "12 Lamaha Street, Georgetown", phone: "592-612-3456", customer: "Aaliyah R.", fee: 550, distance: "2.3 km", lat: 6.812, lng: -58.155 },
  { id: "DEL-442", business: "Craft Plus Too", item: "Wooden Bowl Set", address: "Hibiscus Craft Plaza, Robbstown", phone: "592-624-8891", customer: "Kevin M.", fee: 450, distance: "1.1 km", lat: 6.808, lng: -58.162 },
  { id: "DEL-443", business: "Guyana Flavours", item: "Spice Gift Box ×3", address: "45 Sheriff Street, Georgetown", phone: "592-671-2203", customer: "Sofia T.", fee: 600, distance: "3.4 km", lat: 6.821, lng: -58.149 }
];

// ===== STATE =====
let cart = [];
let currentRole = 'selector';

// ===== ROLE SWITCHING =====

// ===== AUTH / LOGIN =====
let pendingRole = null;
let authMode = "signin";
let currentUser = null;

const DEMO_USERS = {}; // production: no demo accounts

// Platform ads managed by Manager
let platformAds = [
  { id: "AD1", headline: "Promote your business here", sub: "Reach shoppers across Guyana · From GYD 5,000/mo", place: "login", status: "Active" },
  { id: "AD2", headline: "Island Breeze — Pepperpot Special", sub: "GYD 4,800 · Free delivery over GYD 4,000 · Georgetown", place: "customer", status: "Active" }
];

// Admin-managed user directories (seeded from demos)
// Platform revenue (demo ledger)
let platformRevenue = { subscriptions: 0, ads: 0 };
try {
  const pr = localStorage.getItem('tgs_revenue');
  if (pr) platformRevenue = JSON.parse(pr);
} catch (_) {}
function saveRevenue() {
  try { localStorage.setItem('tgs_revenue', JSON.stringify(platformRevenue)); } catch (_) {}
}

// Business-purchased ads (pending payment -> live)
let businessAds = [];
try {
  const ba = localStorage.getItem('tgs_biz_ads');
  if (ba) businessAds = JSON.parse(ba);
} catch (_) {}
function saveBusinessAds() {
  try { localStorage.setItem('tgs_biz_ads', JSON.stringify(businessAds)); } catch (_) {}
}

// ===== BUSINESS LOGOS (shown on customer deal cards) =====
let businessLogos = {};
try {
  const bl = localStorage.getItem('tgs_biz_logos');
  if (bl) businessLogos = JSON.parse(bl);
} catch (_) {}
function saveBusinessLogos() {
  try { localStorage.setItem('tgs_biz_logos', JSON.stringify(businessLogos)); } catch (_) {}
}
function getBusinessLogo(name) {
  if (!name) return null;
  return businessLogos[name] || null;
}

function uploadBusinessLogo(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) { showToast('Please choose an image'); return; }
  const reader = new FileReader();
  reader.onload = () => {
    const bizName = (currentUser && currentUser.businessName) || 'Island Breeze Restaurant';
    businessLogos[bizName] = reader.result;
    saveBusinessLogos();
    // Update admin user record
    const u = adminUsers.find(x => x.role === 'business' && (x.businessName === bizName || (currentUser && x.identifier === currentUser.identifier)));
    if (u) { u.logo = reader.result; persistAdminData(); }
    updateBizLogoPreview();
    if (typeof renderDeals === 'function') {
      renderDeals(document.querySelector('.cat.active')?.dataset?.cat || 'all');
    }
    showToast('Logo updated — visible on customer deals');
  };
  reader.readAsDataURL(file);
}

function clearBusinessLogo() {
  const bizName = (currentUser && currentUser.businessName) || 'Island Breeze Restaurant';
  delete businessLogos[bizName];
  saveBusinessLogos();
  const u = adminUsers.find(x => x.role === 'business' && x.businessName === bizName);
  if (u) { u.logo = null; persistAdminData(); }
  updateBizLogoPreview();
  if (typeof renderDeals === 'function') {
    renderDeals(document.querySelector('.cat.active')?.dataset?.cat || 'all');
  }
  showToast('Logo removed');
}

function updateBizLogoPreview() {
  const bizName = (currentUser && currentUser.businessName) || 'Island Breeze Restaurant';
  const prev = document.getElementById('biz-logo-preview');
  if (!prev) return;
  const logo = getBusinessLogo(bizName);
  if (logo) {
    prev.innerHTML = `<img src="${logo}" alt="Logo">`;
  } else {
    prev.textContent = '🏪';
  }
}

function persistAdminData() {
  try {
    localStorage.setItem('tgs_admin_users', JSON.stringify(adminUsers));
    localStorage.setItem('tgs_platform_ads', JSON.stringify(platformAds));
    localStorage.setItem('tgs_revenue', JSON.stringify(platformRevenue));
    localStorage.setItem('tgs_biz_logos', JSON.stringify(businessLogos));
    localStorage.setItem('tgs_biz_ads', JSON.stringify(businessAds));
  } catch (_) {}
}

function loadPersistedAdminData() {
  try {
    const u = localStorage.getItem('tgs_admin_users');
    if (u) {
      const parsed = JSON.parse(u);
      if (Array.isArray(parsed) && parsed.length) adminUsers = parsed;
    }
    const a = localStorage.getItem('tgs_platform_ads');
    if (a) {
      const parsed = JSON.parse(a);
      if (Array.isArray(parsed) && parsed.length) platformAds = parsed;
    }
  } catch (_) {}
}

function saveAllManagerChanges() {
  // Sync live subscription status from current biz session into admin users
  syncManagerWithLiveApp();
  persistAdminData();
  saveRevenue();
  saveBusinessAds();
  saveBusinessLogos();
  renderManager();
  applyPlatformAds();
  showToast('All manager changes saved ✅');
}

function syncManagerWithLiveApp() {
  // Refresh subscription status for businesses from local sub if matching user
  try {
    const sub = typeof loadSubscription === 'function' ? loadSubscription() : null;
    if (sub && currentUser && currentUser.role === 'business') {
      const u = adminUsers.find(x => x.identifier === currentUser.identifier);
      if (u) {
        u.subscription = sub.plan || u.subscription;
        u.paidUntil = sub.paidUntil || u.paidUntil;
        u.dealsPosted = sub.dealsPosted;
      }
    }
  } catch (_) {}
  // Pull logos from businessLogos into user records
  adminUsers.forEach(u => {
    if (u.role === 'business' && u.businessName && businessLogos[u.businessName]) {
      u.logo = businessLogos[u.businessName];
    }
  });
  // Ensure Island Breeze logo key exists in logos if user has one
  adminUsers.filter(u => u.role === 'business' && u.logo).forEach(u => {
    if (u.businessName) businessLogos[u.businessName] = u.logo;
  });
}



let selectedAdPlan = 'day'; // day = 1000, week = 5000

// STRICT manager portal credentials — only these may access Manager
const MANAGER_USERNAME = 'raulkc';
const MANAGER_PASSWORD = 'tiromini';

let platformActivity = [];
try {
  const pa = localStorage.getItem('tgs_activity');
  if (pa) platformActivity = JSON.parse(pa);
} catch (_) {}
function saveActivity() {
  try { localStorage.setItem('tgs_activity', JSON.stringify(platformActivity.slice(0, 300))); } catch (_) {}
}
function logActivity(type, message, meta) {
  platformActivity.unshift({
    id: 'ACT' + Date.now(),
    type: type || 'info',
    message: message || '',
    meta: meta || {},
    at: new Date().toISOString()
  });
  saveActivity();
}

let paymentLedger = [];
try {
  const pl = localStorage.getItem('tgs_payments');
  if (pl) paymentLedger = JSON.parse(pl);
} catch (_) {}
function savePayments() {
  try { localStorage.setItem('tgs_payments', JSON.stringify(paymentLedger.slice(0, 300))); } catch (_) {}
}
function logPayment(kind, amount, detail, meta) {
  paymentLedger.unshift({
    id: 'PAY' + Date.now(),
    kind, // subscription | ad
    amount: amount || 0,
    detail: detail || '',
    meta: meta || {},
    at: new Date().toISOString()
  });
  savePayments();
  if (kind === 'subscription') {
    platformRevenue.subscriptions = (platformRevenue.subscriptions || 0) + (amount || 0);
  } else if (kind === 'ad') {
    platformRevenue.ads = (platformRevenue.ads || 0) + (amount || 0);
  }
  if (typeof saveRevenue === 'function') saveRevenue();
}

let adminUsers = [];
try {
  const au = localStorage.getItem('tgs_admin_users');
  if (au) adminUsers = JSON.parse(au);
} catch (_) {}
function saveAdminUsers() {
  try { localStorage.setItem('tgs_admin_users', JSON.stringify(adminUsers)); } catch (_) {}
}

function startLogin(role) {
  pendingRole = role;
  authMode = "signin";
  setAuthMode("signin");
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById("login-screen").classList.add("active");
  if (typeof applyPlatformAds === "function") applyPlatformAds();

  const titles = {
    customer: ["Customer sign in", "Browse deals & place orders"],
    business: ["Business sign in", "Manage deals & settlements"],
    delivery: ["Rider sign in", "Accept & deliver orders"],
    manager: ["Manager sign in", "Authorized access only"]
  };
  const t = titles[role] || ["Sign in", "Welcome"];
  document.getElementById("login-role-title").textContent = t[0];
  document.getElementById("login-role-sub").textContent = t[1];

  document.getElementById("business-group").style.display = role === "business" && authMode === "signup" ? "block" : "none";
  document.getElementById("auth-identifier").value = "";
  document.getElementById("auth-password").value = "";
  const idInput = document.getElementById("auth-identifier");
  const idLabel = document.getElementById("auth-id-label");
  if (role === "manager") {
    if (idLabel) idLabel.textContent = "Username";
    if (idInput) idInput.placeholder = "Manager username";
    setAuthMode("signin");
    // Hide create account for manager
    document.querySelectorAll(".login-tab").forEach(t => {
      if (t.dataset.mode === "signup") t.style.display = "none";
    });
  } else {
    if (idLabel) idLabel.textContent = "Email or phone";
    if (idInput) idInput.placeholder = "you@email.com or 592-6XX-XXXX";
    document.querySelectorAll(".login-tab").forEach(t => { t.style.display = ""; });
  }
  document.getElementById("auth-name").value = "";
  document.getElementById("auth-business").value = "";
}

function backToRoles() {
  pendingRole = null;
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById("role-selector").classList.add("active");
}

function syncEmailToIdentifier() {
  const em = document.getElementById("auth-email");
  const id = document.getElementById("auth-identifier");
  if (em && id && authMode === "signup" && em.value.trim() && !id.value.trim()) {
    id.value = em.value.trim();
  }
}

function setAuthMode(mode) {
  authMode = mode;
  document.querySelectorAll(".login-tab").forEach(t => {
    t.classList.toggle("active", t.dataset.mode === mode);
  });
  const isSignup = mode === "signup";
  document.getElementById("name-group").style.display = isSignup ? "block" : "none";
  document.getElementById("business-group").style.display =
    (isSignup && pendingRole === "business") ? "block" : "none";
  const phoneG = document.getElementById("phone-group");
  const emailG = document.getElementById("email-group");
  const hint = document.getElementById("signup-email-hint");
  const idLabel = document.getElementById("auth-id-label");
  if (phoneG) phoneG.style.display = isSignup ? "block" : "none";
  if (emailG) emailG.style.display = isSignup ? "block" : "none";
  if (hint) hint.style.display = isSignup ? "block" : "none";
  if (idLabel) idLabel.textContent = isSignup ? "Login email (same as above or phone)" : "Email or phone";
  const idInput = document.getElementById("auth-identifier");
  if (idInput) idInput.placeholder = isSignup ? "Same email or your phone" : "you@email.com or 592-6XX-XXXX";
  document.getElementById("auth-submit").textContent = isSignup ? "Create account" : "Sign in";
  const pw = document.getElementById("auth-password");
  if (pw) pw.placeholder = isSignup ? "Create a secure password (min 6)" : "Your password";
}

function fillDemo(role) {
  showToast('Demo accounts removed. Please create your own account.');
}

async function handleAuth(e) {
  e.preventDefault();
  const identifier = document.getElementById("auth-identifier").value.trim();
  const password = document.getElementById("auth-password").value;
  const name = document.getElementById("auth-name").value.trim();
  const businessName = document.getElementById("auth-business").value.trim();
  const emailField = document.getElementById("auth-email")?.value?.trim() || "";
  const phoneField = document.getElementById("auth-phone")?.value?.trim() || "";

  if (!password) {
    showToast("Enter your password");
    return false;
  }
  if (!identifier && !(document.getElementById("auth-email")?.value?.trim())) {
    showToast("Enter your email address");
    return false;
  }
  if (password.length < 6) {
    showToast("Password must be at least 6 characters");
    return false;
  }

  // Manager portal: ONLY username raulkc / password tiromini
  if (pendingRole === "manager") {
    if (authMode === "signup") {
      showToast("Manager accounts cannot be created. Contact platform owner.");
      return false;
    }
    const userOk = identifier.toLowerCase() === MANAGER_USERNAME.toLowerCase();
    const passOk = password === MANAGER_PASSWORD;
    if (!userOk || !passOk) {
      showToast("Access denied. Invalid manager credentials.");
      return false;
    }
    const user = {
      id: "MGR-OWNER",
      identifier: MANAGER_USERNAME,
      name: "Platform Manager",
      role: "manager",
      email: "",
      phone: ""
    };
    currentUser = user;
    try { localStorage.setItem("tgs_user", JSON.stringify(user)); } catch (_) {}
    showToast("Welcome, Manager");
    enterApp("manager");
    return false;
  }

  if (authMode === "signup") {
    if (!name) {
      showToast("Please enter your full name");
      return false;
    }
    const email = emailField || (identifier.includes("@") ? identifier : "");
    if (!email || !email.includes("@")) {
      showToast("Email is required so we can send your login details");
      return false;
    }
    if (pendingRole === "business" && !businessName) {
      showToast("Please enter your business name");
      return false;
    }
  }

  // Prefer dedicated email field; allow identifier to be email
  let email = emailField || (identifier.includes("@") ? identifier : "");
  const phone = phoneField || (!identifier.includes("@") ? identifier : "");
  // If user only filled the Email field, use it as identifier
  let loginId = identifier || email;
  if (!loginId && email) loginId = email;
  if (authMode === "signup" && !email && loginId.includes("@")) email = loginId;

  if (authMode === "signup" && (!email || !email.includes("@"))) {
    showToast("Enter a valid email address");
    return false;
  }

  let user = null;
  const path = authMode === "signup" ? "/api/auth/register" : "/api/auth/login";
  const body = {
    identifier: email || loginId,
    password,
    role: pendingRole || "customer",
    name: name || undefined,
    businessName: businessName || undefined,
    email: email || undefined,
    phone: phone || undefined
  };

  let apiResult = await api(path, { method: "POST", body: JSON.stringify(body) });

  // Offline / server down → local accounts still work
  if (!apiResult || apiResult.offline || (apiResult.success === false && !apiResult.error)) {
    if (authMode === "signup") {
      apiResult = registerLocalUser(body);
    } else {
      apiResult = loginLocalUser(email || loginId, password, pendingRole || "customer");
    }
  } else if (apiResult && apiResult.success === false && apiResult.offline) {
    if (authMode === "signup") apiResult = registerLocalUser(body);
    else apiResult = loginLocalUser(email || loginId, password, pendingRole || "customer");
  }

  if (apiResult && apiResult.success) {
    user = apiResult.user;
    if (authMode === "signup") {
      showToast(apiResult.emailSent
        ? "Account created! Check your email for login details."
        : (apiResult.local
          ? "Account created! You can sign in with your email and password."
          : "Account created! Confirmation email queued."));
    } else {
      showToast("Welcome, " + (user.name || "there") + "!");
    }
  } else {
    showToast((apiResult && apiResult.error) || (authMode === "signup" ? "Could not create account" : "Invalid email/phone or password"));
    return false;
  }

  // Sync into manager directory
  if (user && typeof adminUsers !== "undefined") {
    const exists = adminUsers.find(u => u.identifier === user.identifier || u.email === user.email);
    if (!exists) {
      adminUsers.push({
        id: user.id,
        name: user.name,
        identifier: user.identifier || user.email,
        role: user.role,
        phone: user.phone || "",
        email: user.email || "",
        businessName: user.businessName,
        subscription: user.role === "business" ? "trial" : "n/a"
      });
      if (typeof saveAdminUsers === "function") saveAdminUsers();
    }
  }

  currentUser = user;
  try { localStorage.setItem("tgs_user", JSON.stringify(user)); } catch (_) {}
  if (authMode === "signup" && typeof logActivity === "function") {
    logActivity("signup", (user.role || "user") + " signed up: " + (user.name || user.email), { role: user.role, email: user.email });
  }
  enterApp(user.role || pendingRole || "customer");
  if (user.role === "delivery" && typeof loadPodHistory === "function") loadPodHistory();
  return false;
}

function enterApp(role) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  if (role === "customer") {
    document.getElementById("customer-app").classList.add("active");
    if (typeof renderDeals === "function") renderDeals();
    applyPlatformAds();
    updateHeaderUser();
    if (typeof updateLiveTrackBanner === "function") updateLiveTrackBanner();
    if (typeof renderCustomerOrders === "function") renderCustomerOrders();
  } else if (role === "business") {
    document.getElementById("business-app").classList.add("active");
    if (typeof renderBusiness === "function") renderBusiness();
    if (typeof updateBizLogoPreview === "function") updateBizLogoPreview();
    updateHeaderUser();
  } else if (role === "delivery") {
    document.getElementById("delivery-app").classList.add("active");
    if (typeof renderRider === "function") renderRider();
    updateHeaderUser();
    if (typeof loadPodHistory === "function") loadPodHistory();
  } else if (role === "manager") {
    const ok = currentUser && (
      currentUser.identifier === MANAGER_USERNAME ||
      (currentUser.role === "manager" && currentUser.id === "MGR-OWNER")
    );
    if (!ok) {
      showToast("Manager access denied");
      document.getElementById("role-selector").classList.add("active");
      return;
    }
    document.getElementById("manager-app").classList.add("active");
    const lbl = document.getElementById("mgr-user-label");
    if (lbl) lbl.textContent = "raulkc";
    renderManager();
  } else {
    document.getElementById("role-selector").classList.add("active");
  }
}

function updateHeaderUser() {
  if (!currentUser) return;
  // Soft update of location lines to show signed-in name
  document.querySelectorAll(".app-header .location").forEach(el => {
    if (currentUser.role === "business" && currentUser.businessName) {
      el.textContent = currentUser.businessName;
    } else if (currentUser.role === "delivery") {
      el.textContent = "Online • " + (currentUser.name || "Rider");
    } else if (currentUser.role === "customer") {
      el.textContent = "📍 Georgetown · " + (currentUser.name || "").split(" ")[0];
    }
  });
  // Profile panel
  const profStrong = document.querySelector(".profile-header strong");
  if (profStrong && currentUser.name) profStrong.textContent = currentUser.name;
  const profSmall = document.querySelector(".profile-header .small");
  if (profSmall) profSmall.textContent = (currentUser.phone || currentUser.email || "") + " · Georgetown";
}

function logout() {
  currentUser = null;
  try { localStorage.removeItem("tgs_user"); } catch (_) {}
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById("role-selector").classList.add("active");
  showToast("Signed out");
}

// Restore session
try {
  const saved = localStorage.getItem("tgs_user");
  if (saved) currentUser = JSON.parse(saved);
} catch (_) {}

function switchRole(role) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  if (role === 'selector') {
    document.getElementById('role-selector').classList.add('active');
  } else if (role === 'customer') {
    document.getElementById('customer-app').classList.add('active');
    renderDeals();
  } else if (role === 'business') {
    document.getElementById('business-app').classList.add('active');
    renderBusiness();
  } else if (role === 'delivery') {
    document.getElementById('delivery-app').classList.add('active');
    renderRider();
  }
  currentRole = role;
  closeModal();
}

// ===== CUSTOMER =====
function renderDeals(filter = 'all') {
  const feed = document.getElementById('deals-feed');
  if (!feed) return;
  const filtered = (filter === 'all' ? deals : deals.filter(d => d.category === filter))
    .filter(d => !d._paused);
  
  feed.innerHTML = filtered.map(d => {
    const logo = (typeof getBusinessLogo === 'function' && getBusinessLogo(d.business)) || d.businessLogo || null;
    return `
    <div class="deal-card" onclick="openDeal(${d.id})">
      <div class="deal-img" ${d.photo ? `style="background-image:url('${d.photo}');background-size:cover;background-position:center"` : ''}>
        <span class="deal-badge">-${d.discount}%</span>
        ${d.photo ? '' : d.emoji}
      </div>
      <div class="deal-body">
        <div class="deal-biz">
          ${logo ? `<img class="biz-logo-inline" src="${logo}" alt="">` : `<span class="biz-logo-placeholder">🏪</span>`}
          <span>${d.business}</span>
        </div>
        <div class="deal-title">${d.title}</div>
        <div class="deal-prices">
          <span class="deal-price">GYD ${d.price.toLocaleString()}</span>
          <span class="deal-original">GYD ${d.original.toLocaleString()}</span>
        </div>
        <div class="deal-meta">
          <span>${d.expires || ((d.daysLeft || 5) + ' days left')}</span>
          <span>${d.distance || ''}</span>
        </div>
      </div>
    </div>
  `;
  }).join('');
}

function openDeal(id) {
  const d = deals.find(x => x.id === id);
  if (!d) return;
  
  document.getElementById('deal-detail').innerHTML = `
    ${d.photo
      ? `<img src="${d.photo}" alt="" style="width:100%;max-height:200px;object-fit:cover;border-radius:12px;margin:8px 0">`
      : `<div style="font-size:56px;text-align:center;margin:12px 0">${d.emoji}</div>`}
    <div class="deal-biz" style="display:flex;align-items:center;gap:8px">
      ${(typeof getBusinessLogo === 'function' && getBusinessLogo(d.business))
        ? `<img class="biz-logo-inline" src="${getBusinessLogo(d.business)}" alt="">`
        : `<span class="biz-logo-placeholder">🏪</span>`}
      ${d.business}
    </div>
    <h2 style="margin:4px 0 12px">${d.title}</h2>
    <div class="deal-prices" style="margin-bottom:12px">
      <span class="deal-price">GYD ${d.price.toLocaleString()}</span>
      <span class="deal-original">GYD ${d.original.toLocaleString()}</span>
      <span style="background:#fee2e2;color:#b91c1c;padding:2px 8px;border-radius:6px;font-size:13px;font-weight:600">-${d.discount}%</span>
    </div>
    <p style="color:#4b5563;margin-bottom:16px">${d.description}</p>
    <p class="small">⏱ ${d.expires} · 📍 ${d.distance} · ${d.delivery ? '🚚 Delivery available' : '🏪 In-store only'}</p>
    
    <div class="qty-control">
      <button onclick="changeQty(-1)">−</button>
      <span id="qty-val">1</span>
      <button onclick="changeQty(1)">+</button>
    </div>
    
    <button class="primary-btn" onclick="addToCart(${d.id})">Add to Cart – GYD <span id="add-price">${d.price.toLocaleString()}</span></button>
  `;
  
  window.currentDeal = d;
  window.currentQty = 1;
  document.getElementById('deal-modal').classList.add('active');
}

function changeQty(delta) {
  window.currentQty = Math.max(1, (window.currentQty || 1) + delta);
  document.getElementById('qty-val').textContent = window.currentQty;
  document.getElementById('add-price').textContent = (window.currentDeal.price * window.currentQty).toLocaleString();
}

function addToCart(id) {
  const d = deals.find(x => x.id === id);
  const qty = window.currentQty || 1;
  const existing = cart.find(c => c.id === id);
  if (existing) {
    existing.qty += qty;
  } else {
    cart.push({ ...d, qty });
  }
  updateCartCount();
  closeModal();
  showToast(`Added ${qty}× ${d.title} to cart`);
}

function updateCartCount() {
  const count = cart.reduce((s, i) => s + i.qty, 0);
  document.getElementById('cart-count').textContent = count;
}

function showCart() {
  if (cart.length === 0) {
    showToast('Your cart is empty');
    return;
  }
  
  const itemsHtml = cart.map(item => `
    <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #f3f4f6">
      <div>
        <strong>${item.title}</strong>
        <div class="small">${item.qty} × GYD ${item.price.toLocaleString()}</div>
      </div>
      <strong>GYD ${(item.price * item.qty).toLocaleString()}</strong>
    </div>
  `).join('');
  
  document.getElementById('cart-items').innerHTML = itemsHtml;
  updateCartTotal();
  document.getElementById('cart-modal').classList.add('active');
  
  // Listen for fulfillment change
  document.querySelectorAll('input[name="fulfillment"]').forEach(r => {
    r.onchange = updateCartTotal;
  });
}

function updateCartTotal() {
  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const isDelivery = document.querySelector('input[name="fulfillment"]:checked')?.value === 'delivery';
  const feeRow = document.getElementById('delivery-fee-row');
  const details = document.getElementById('delivery-details');
  
  let deliveryFee = 0;
  if (isDelivery) {
    feeRow.classList.remove('hidden');
    if (details) details.classList.remove('hidden');
    if (subtotal >= 4000) {
      document.getElementById('delivery-fee-amount').textContent = 'FREE';
      deliveryFee = 0;
    } else {
      document.getElementById('delivery-fee-amount').textContent = 'GYD 500';
      deliveryFee = 500;
    }
  } else {
    feeRow.classList.add('hidden');
    if (details) details.classList.add('hidden');
  }
  
  document.getElementById('cart-total').textContent = `GYD ${(subtotal + deliveryFee).toLocaleString()}`;
}

function placeOrder() {
  const isDelivery = document.querySelector('input[name="fulfillment"]:checked')?.value === 'delivery';
  
  if (isDelivery) {
    const addr = document.getElementById('delivery-address')?.value?.trim();
    const phone = document.getElementById('delivery-phone')?.value?.trim();
    if (!addr || !phone) {
      showToast('Please enter delivery address and contact number');
      return;
    }
    // Store for tracking screen
    window.lastDelivery = { address: addr, phone: phone };
    if (typeof createLiveOrder === 'function' && isDelivery) {
      const totalEl = document.getElementById('cart-total');
      const totalTxt = totalEl ? totalEl.textContent.replace(/[^0-9]/g, '') : '0';
      const live = createLiveOrder({
        item: (cart && cart[0]) ? cart.map(x => x.title || x.name || 'Item').join(', ') : 'Delivery order',
        total: parseInt(totalTxt, 10) || 0,
        address: addr,
        phone: phone
      });
      window.activeTrackOrderId = live.id;
      window.lastDelivery.orderId = live.id;
    }
  }
  
  cart = [];
  updateCartCount();
  closeModal();
  
  if (isDelivery) {
    showToast('Order placed! A rider will pick it up soon 🛵');
    // After a short delay show the tracking modal (demo)
    setTimeout(() => {
      if (window.lastDelivery) {
        openTrackingWithRider(window.lastDelivery.address, window.lastDelivery.phone);
      }
    }, 1800);
  } else {
    showToast('Order placed! Show your voucher in-store 🎁');
  }
}

// Category filters
document.querySelectorAll('.cat').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.cat').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderDeals(btn.dataset.cat);
  });
});

// ===== BUSINESS =====

// ===== NEW DEAL COMPOSER =====

// ===== BUSINESS SUBSCRIPTION (GYD 5,000 / month via MMG 6124940) =====
const SUB_FEE_GYD = 5000;
const SUB_MMG_NUMBER = '6124940';
const FREE_TRIAL_DAYS = 30;
const FREE_MAX_DEALS = 1;
const PAID_MAX_DEALS = 10;

function defaultSubscription() {
  const start = new Date();
  const end = new Date(start);
  end.setDate(end.getDate() + FREE_TRIAL_DAYS);
  return {
    plan: 'trial',           // trial | paid | expired
    trialStart: start.toISOString(),
    trialEnds: end.toISOString(),
    dealsPosted: 0,          // user-posted during free/paid
    paidUntil: null,
    lastPaymentRef: null
  };
}

function loadSubscription() {
  try {
    const raw = localStorage.getItem('tgs_biz_sub');
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  const s = defaultSubscription();
  saveSubscription(s);
  return s;
}

function saveSubscription(s) {
  try { localStorage.setItem('tgs_biz_sub', JSON.stringify(s)); } catch (_) {}
}

let bizSubscription = loadSubscription();
const SETTLEMENT_HTML = "\n        <h3>Weekly Settlement</h3>\n        <div class=\"settlement-card\">\n          <div class=\"settle-header\">\n            <span>21\u201327 July 2026</span>\n            <span class=\"status paid\">Processing</span>\n          </div>\n          <div class=\"settle-row\"><span>Gross Sales</span><strong>GYD 142,900</strong></div>\n          <div class=\"settle-row\"><span>Platform Commission (7%)</span><span class=\"neg\">\u2013 GYD 8,947</span></div>\n          <div class=\"settle-row\"><span>Free Delivery Subsidy</span><span class=\"neg\">\u2013 GYD 6,050</span></div>\n          <div class=\"settle-row\"><span>Subscription (weekly)</span><span class=\"neg\">\u2013 GYD 2,375</span></div>\n          <div class=\"settle-row\"><span>Processing & COD fees</span><span class=\"neg\">\u2013 GYD 1,955</span></div>\n          <div class=\"settle-total\">\n            <span>Amount Due</span>\n            <strong>GYD 114,626</strong>\n          </div>\n          <div class=\"deduction-visual\">\n            <div class=\"bar-seg\" style=\"width:46.3%;background:#e74c3c\" title=\"Commission 46.3%\"></div>\n            <div class=\"bar-seg\" style=\"width:31.3%;background:#f39c12\" title=\"Free Delivery 31.3%\"></div>\n            <div class=\"bar-seg\" style=\"width:12.3%;background:#3498db\" title=\"Subscription 12.3%\"></div>\n            <div class=\"bar-seg\" style=\"width:6.6%;background:#9b59b6\" title=\"Processing 6.6%\"></div>\n            <div class=\"bar-seg\" style=\"width:3.5%;background:#1abc9c\" title=\"COD 3.5%\"></div>\n          </div>\n          <div class=\"legend\">\n            <span><i style=\"background:#e74c3c\"></i> Commission</span>\n            <span><i style=\"background:#f39c12\"></i> Free Delivery</span>\n            <span><i style=\"background:#3498db\"></i> Subscription</span>\n            <span><i style=\"background:#9b59b6\"></i> Processing</span>\n            <span><i style=\"background:#1abc9c\"></i> COD</span>\n          </div>\n        ";

function daysLeft(iso) {
  if (!iso) return 0;
  const ms = new Date(iso) - Date.now();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

function refreshSubscriptionStatus() {
  const s = bizSubscription;
  const now = Date.now();
  if (s.plan === 'paid' && s.paidUntil) {
    if (new Date(s.paidUntil).getTime() < now) {
      s.plan = 'expired';
      saveSubscription(s);
    }
  } else if (s.plan === 'trial') {
    if (new Date(s.trialEnds).getTime() < now) {
      s.plan = 'expired';
      saveSubscription(s);
    }
  }
  return s;
}

function canPostDeal() {
  const s = refreshSubscriptionStatus();
  if (s.plan === 'paid') {
    if (s.dealsPosted >= PAID_MAX_DEALS) {
      return { ok: false, reason: 'Paid plan allows up to 10 deals this month. Limit reached — renew next month or contact support.' };
    }
    return { ok: true };
  }
  if (s.plan === 'trial') {
    if (s.dealsPosted >= FREE_MAX_DEALS) {
      return { ok: false, reason: 'Free plan allows only 1 deal. Subscribe for GYD 5,000/month via MMG (up to 10 deals).' };
    }
    return { ok: true };
  }
  return { ok: false, reason: 'Your free month has ended. Pay GYD 5,000 via MMG to 6124940 to continue.' };
}

function canAccessFullPortal() {
  const s = refreshSubscriptionStatus();
  return s.plan === 'trial' || s.plan === 'paid';
}

function updateSubscriptionUI() {
  const s = refreshSubscriptionStatus();
  const card = document.getElementById('sub-card');
  const badge = document.getElementById('biz-plan-badge');
  const label = document.getElementById('sub-status-label');
  const title = document.getElementById('sub-status-title');
  const desc = document.getElementById('sub-desc');
  const meta = document.getElementById('sub-meta');
  const payBtn = document.getElementById('sub-pay-btn');
  if (!card) return;

  card.classList.remove('paid', 'expired');
  if (badge) badge.classList.remove('trial', 'paid', 'expired');

  if (s.plan === 'paid') {
    card.classList.add('paid');
    if (badge) { badge.textContent = 'Subscribed'; badge.classList.add('paid'); }
    if (label) label.textContent = 'Active subscription';
    if (title) title.textContent = 'Up to 10 deals · Full portal access';
    if (desc) desc.innerHTML = 'Thank you! Your monthly plan is active. Renew before expiry to avoid interruption.';
    if (meta) meta.textContent = 'Paid until ' + new Date(s.paidUntil).toLocaleDateString() +
      ' · Deals used: ' + s.dealsPosted + ' / ' + PAID_MAX_DEALS +
      (s.lastPaymentRef ? ' · Ref ' + s.lastPaymentRef : '');
    if (payBtn) payBtn.style.display = 'none';
  } else if (s.plan === 'trial') {
    if (badge) { badge.textContent = 'Free Trial'; badge.classList.add('trial'); }
    if (label) label.textContent = 'Free trial';
    if (title) title.textContent = '1 deal · 30 days full access';
    if (desc) desc.innerHTML =
      'Free plan: post <strong>1 deal</strong> and use the full portal for <strong>1 month</strong>. ' +
      'After that, subscribe (GYD 5,000/mo via MMG) for up to <strong>10 deals</strong> plus orders & settlements.';
    if (meta) meta.textContent =
      'Trial ends in ' + daysLeft(s.trialEnds) + ' days · Deals used: ' + s.dealsPosted + ' / ' + FREE_MAX_DEALS;
    if (payBtn) {
      payBtn.style.display = 'block';
      payBtn.textContent = 'Upgrade — Pay GYD 5,000 via MMG';
    }
  } else {
    card.classList.add('expired');
    if (badge) { badge.textContent = 'Expired'; badge.classList.add('expired'); }
    if (label) label.textContent = 'Subscription required';
    if (title) title.textContent = 'Full access locked';
    if (desc) desc.innerHTML =
      'Your free month has ended. Pay <strong>GYD 5,000</strong> monthly via MMG to ' +
      '<strong>6124940</strong> to post deals, receive orders, and view settlements.';
    if (meta) meta.textContent = 'Deals posted on free plan: ' + s.dealsPosted;
    if (payBtn) {
      payBtn.style.display = 'block';
      payBtn.textContent = 'Pay GYD 5,000 via MMG';
    }
  }
}

function openSubscriptionPay() {
  const ref = 'TGS-' + Date.now().toString(36).toUpperCase();
  const refEl = document.getElementById('mmg-ref');
  if (refEl) refEl.textContent = ref;
  window._pendingSubRef = ref;
  document.getElementById('sub-pay-modal')?.classList.add('active');
}

async function confirmSubscriptionPayment() {
  const phone = document.getElementById('sub-mmg-phone')?.value?.trim() || '';
  const txid = document.getElementById('sub-mmg-txid')?.value?.trim() || '';
  if (phone.length < 7) {
    showToast('Enter the MMG phone number you paid from');
    return;
  }
  if (txid.length < 4) {
    showToast('Enter the MMG transaction ID / reference');
    return;
  }

  const paidUntil = new Date();
  paidUntil.setDate(paidUntil.getDate() + 30);
  bizSubscription.plan = 'paid';
  bizSubscription.paidUntil = paidUntil.toISOString();
  bizSubscription.dealsPosted = 0; // new billing period: 10-deal allowance resets
  bizSubscription.lastPaymentRef = txid;
  bizSubscription.mmgPhone = phone;
  bizSubscription.mmgTo = SUB_MMG_NUMBER;
  bizSubscription.amount = SUB_FEE_GYD;
  saveSubscription(bizSubscription);

  // Notify backend if available
  if (typeof api === 'function') {
    await api('/api/business/subscribe', {
      method: 'POST',
      body: JSON.stringify({
        mmgPhone: phone,
        txid,
        amount: SUB_FEE_GYD,
        mmgTo: SUB_MMG_NUMBER,
        reference: window._pendingSubRef || null
      })
    });
  }

  closeModal();
  updateSubscriptionUI();
  renderBusiness();
  if (typeof logPayment === 'function') {
    logPayment('subscription', SUB_FEE_GYD, 'Business monthly subscription via MMG', {
      mmg: '6124940', business: (currentUser && currentUser.businessName) || ''
    });
  } else {
    platformRevenue.subscriptions = (platformRevenue.subscriptions || 0) + SUB_FEE_GYD;
    saveRevenue();
  }
  if (typeof logActivity === 'function') {
    logActivity('payment', 'Subscription paid GYD ' + SUB_FEE_GYD, { kind: 'subscription' });
  }
  // Mark current business user as subscribed in admin list
  if (currentUser && currentUser.role === 'business') {
    const u = adminUsers.find(x => x.identifier === currentUser.identifier || x.id === currentUser.id);
    if (u) {
      u.subscription = 'paid';
      u.paidUntil = bizSubscription.paidUntil;
    }
  }
  showToast('Subscription activated for 30 days! ✅');
}


function resetDealPhotoUI() {
  pendingDealPhoto = null;
  const prev = document.getElementById('nd-photo-preview');
  const ph = document.getElementById('nd-photo-placeholder');
  const file = document.getElementById('nd-photo');
  if (prev) { prev.src = ''; prev.classList.add('hidden'); }
  if (ph) ph.classList.remove('hidden');
  if (file) file.value = '';
}

function previewDealPhoto(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    showToast('Please choose an image file');
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    pendingDealPhoto = reader.result;
    const prev = document.getElementById('nd-photo-preview');
    const ph = document.getElementById('nd-photo-placeholder');
    if (prev) { prev.src = pendingDealPhoto; prev.classList.remove('hidden'); }
    if (ph) ph.classList.add('hidden');
  };
  reader.readAsDataURL(file);
}

function openNewDealModal() {
  const gate = canPostDeal();
  if (!gate.ok) {
    showToast(gate.reason);
    openSubscriptionPay();
    return;
  }
  editingDealId = null;
  document.getElementById('nd-edit-id').value = '';
  document.getElementById('nd-modal-title').textContent = 'Post a New Deal';
  document.getElementById('nd-submit-btn').textContent = 'Publish Deal';
  document.getElementById('nd-title').value = '';
  document.getElementById('nd-desc').value = '';
  document.getElementById('nd-price').value = '';
  document.getElementById('nd-original').value = '';
  document.getElementById('nd-category').value = 'food';
  document.getElementById('nd-days').value = '5';
  document.getElementById('nd-emoji').value = '🎁';
  resetDealPhotoUI();
  document.getElementById('new-deal-modal')?.classList.add('active');
}

function editDeal(id) {
  const d = businessDeals.find(x => x.id === id);
  if (!d) return;
  editingDealId = id;
  document.getElementById('nd-edit-id').value = id;
  document.getElementById('nd-modal-title').textContent = 'Edit Deal';
  document.getElementById('nd-submit-btn').textContent = 'Save Changes';
  document.getElementById('nd-title').value = d.title || '';
  document.getElementById('nd-desc').value = d.description || '';
  document.getElementById('nd-price').value = d.price || '';
  document.getElementById('nd-original').value = d.original || '';
  document.getElementById('nd-category').value = d.category || 'food';
  document.getElementById('nd-days').value = String(d.daysLeft || 5);
  document.getElementById('nd-emoji').value = d.emoji || '🎁';
  resetDealPhotoUI();
  if (d.photo) {
    pendingDealPhoto = d.photo;
    const prev = document.getElementById('nd-photo-preview');
    const ph = document.getElementById('nd-photo-placeholder');
    if (prev) { prev.src = d.photo; prev.classList.remove('hidden'); }
    if (ph) ph.classList.add('hidden');
  }
  document.getElementById('new-deal-modal')?.classList.add('active');
}

function pauseDeal(id) {
  const d = businessDeals.find(x => x.id === id);
  if (!d) return;
  d.status = 'Paused';
  // Hide from customer feed if linked
  if (typeof deals !== 'undefined' && d.customerDealId) {
    const cd = deals.find(x => x.id === d.customerDealId);
    if (cd) cd._paused = true;
  }
  renderBusiness();
  if (typeof renderDeals === 'function') {
    const cat = document.querySelector('.cat.active')?.dataset?.cat || 'all';
    renderDeals(cat);
  }
  showToast('Deal paused: ' + d.title);
}

function resumeDeal(id) {
  const d = businessDeals.find(x => x.id === id);
  if (!d) return;
  d.status = 'Active';
  if (typeof deals !== 'undefined' && d.customerDealId) {
    const cd = deals.find(x => x.id === d.customerDealId);
    if (cd) cd._paused = false;
  }
  renderBusiness();
  if (typeof renderDeals === 'function') {
    const cat = document.querySelector('.cat.active')?.dataset?.cat || 'all';
    renderDeals(cat);
  }
  showToast('Deal resumed: ' + d.title);
}

async function submitNewDeal(e) {
  e.preventDefault();
  const gate = canPostDeal();
  if (!gate.ok) {
    showToast(gate.reason);
    closeModal();
    openSubscriptionPay();
    return false;
  }
  const title = document.getElementById('nd-title').value.trim();
  const description = document.getElementById('nd-desc').value.trim() || title;
  const price = parseInt(document.getElementById('nd-price').value, 10);
  const original = parseInt(document.getElementById('nd-original').value, 10) || Math.round(price * 1.3);
  const category = document.getElementById('nd-category').value;
  const daysLeft = parseInt(document.getElementById('nd-days').value, 10);
  const emoji = document.getElementById('nd-emoji').value.trim() || '🎁';
  const editId = document.getElementById('nd-edit-id').value || editingDealId;

  if (!title || !price || price < 100) {
    showToast('Enter a title and valid price');
    return false;
  }

  const discount = original > price ? Math.round((1 - price / original) * 100) : 0;
  const bizName = (currentUser && currentUser.businessName) || 'Island Breeze Restaurant';
  const photo = pendingDealPhoto;

  // EDIT existing deal
  if (editId) {
    const d = businessDeals.find(x => x.id === editId);
    if (d) {
      d.title = title;
      d.description = description;
      d.price = price;
      d.original = original;
      d.category = category;
      d.daysLeft = daysLeft;
      d.emoji = emoji;
      if (photo) d.photo = photo;
      if (typeof deals !== 'undefined' && d.customerDealId) {
        const cd = deals.find(x => x.id === d.customerDealId);
        if (cd) {
          cd.title = title; cd.description = description; cd.price = price;
          cd.original = original; cd.discount = discount; cd.category = category;
          cd.daysLeft = daysLeft; cd.emoji = emoji;
          if (photo) { cd.photo = photo; cd.emoji = emoji; }
        }
      }
    }
    closeModal();
    editingDealId = null;
    renderBusiness();
    if (typeof renderDeals === 'function') {
      renderDeals(document.querySelector('.cat.active')?.dataset?.cat || 'all');
    }
    showToast('Deal updated: ' + title);
    return false;
  }

  // CREATE new deal
  const bizId = 'BD' + Date.now().toString(36).toUpperCase();
  const newId = (typeof deals !== 'undefined' && deals.length)
    ? Math.max(...deals.map(d => d.id)) + 1
    : Date.now();

  const bizDeal = {
    id: bizId,
    title,
    price,
    original,
    status: 'Active',
    redemptions: 0,
    photo: photo || null,
    emoji,
    description,
    category,
    daysLeft,
    customerDealId: newId
  };
  businessDeals.unshift(bizDeal);
  bizSubscription.dealsPosted = (bizSubscription.dealsPosted || 0) + 1;
  saveSubscription(bizSubscription);

  const customerDeal = {
    id: newId,
    business: bizName,
    title,
    price,
    original,
    discount,
    category,
    emoji,
    description,
    daysLeft,
    distance: '1.0 km',
    delivery: true,
    photo: photo || null,
    _paused: false
  };
  if (typeof deals !== 'undefined') deals.unshift(customerDeal);

  if (typeof api === 'function') {
    await api('/api/deals', {
      method: 'POST',
      body: JSON.stringify({ ...customerDeal, photo: photo ? '[image]' : null })
    });
  }

  closeModal();
  editingDealId = null;
  renderBusiness();
  if (typeof renderDeals === 'function') {
    renderDeals(document.querySelector('.cat.active')?.dataset?.cat || 'all');
  }
  const adc = document.getElementById('biz-active-deals-count');
  if (adc) adc.textContent = String(businessDeals.filter(d => d.status === 'Active').length);

  showToast('Deal published: ' + title + ' 🎉');
  return false;
}

function renderBusiness() {
  updateSubscriptionUI();
  if (typeof renderBizAds === "function") renderBizAds();
  if (typeof updateBizLogoPreview === "function") updateBizLogoPreview();
  const fullAccess = canAccessFullPortal();

  // Lock orders / settlement when expired
  const ordersPanel = document.getElementById('biz-orders');
  const settlePanel = document.getElementById('biz-settlement');
  if (ordersPanel) {
    if (!fullAccess) {
      ordersPanel.innerHTML = `<div class="locked-panel">
        <div style="font-size:28px">🔒</div>
        <strong>Orders locked</strong>
        <p>Subscribe for GYD 5,000/month via MMG to <strong>6124940</strong> to receive and manage orders.</p>
        <button class="primary-btn" onclick="openSubscriptionPay()">Pay via MMG</button>
      </div>`;
    } else {
      ordersPanel.innerHTML = `<h3>Incoming Orders</h3><div class="order-list" id="biz-order-list"></div>`;
    }
  }
  if (settlePanel) {
    if (!fullAccess) {
      settlePanel.innerHTML = `<div class="locked-panel">
        <div style="font-size:28px">🔒</div>
        <strong>Settlements locked</strong>
        <p>Pay the monthly fee (GYD 5,000 via MMG <strong>6124940</strong>) to view payouts and settlement statements.</p>
        <button class="primary-btn" onclick="openSubscriptionPay()">Pay via MMG</button>
      </div>`;
    } else {
      settlePanel.innerHTML = SETTLEMENT_HTML;
    }
  }

  // Deals
  document.getElementById('biz-deal-list').innerHTML = businessDeals.map(d => `
    <div class="biz-deal-card">
      <div class="biz-deal-row">
        ${d.photo
          ? `<img class="deal-thumb" src="${d.photo}" alt="">`
          : `<div class="deal-thumb" style="display:flex;align-items:center;justify-content:center;font-size:22px">${d.emoji || '🎁'}</div>`}
        <div class="deal-info">
          <h4>${d.title}</h4>
          <div class="meta">GYD ${d.price.toLocaleString()} · ${d.redemptions || 0} redemptions</div>
          <span class="status-pill ${d.status === 'Active' ? 'active' : 'pending'}">${d.status}</span>
        </div>
      </div>
      <div class="deal-actions">
        <button type="button" class="btn-edit" onclick="editDeal('${d.id}')">✏️ Edit</button>
        ${d.status === 'Active'
          ? `<button type="button" class="btn-pause" onclick="pauseDeal('${d.id}')">⏸ Pause</button>`
          : `<button type="button" class="btn-resume" onclick="resumeDeal('${d.id}')">▶ Resume</button>`}
      </div>
    </div>
  `).join('');
  
  const adc = document.getElementById('biz-active-deals-count');
  if (adc) adc.textContent = String(businessDeals.filter(d => d.status === 'Active').length);

  // Orders (only if full access)
  if (!canAccessFullPortal()) {
    return;
  }
  const orderList = document.getElementById('biz-order-list');
  if (!orderList) return;
  orderList.innerHTML = incomingOrders.map(o => `
    <div class="order-card">
      <h4>${o.item}</h4>
      <div class="meta">${o.id} · ${o.customer} · ${o.type}</div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px">
        <strong>GYD ${o.total.toLocaleString()}</strong>
        <span class="status-pill ${o.status === 'Ready' ? 'ready' : o.status === 'New' ? 'pending' : 'active'}">${o.status}</span>
      </div>
      ${o.status === 'New' || o.status === 'Preparing' ? `
        <button class="primary-btn small" style="margin-top:10px" onclick="markReady('${o.id}')">
          Mark Ready for Rider
        </button>
      ` : ''}
    </div>
  `).join('');
}

function markReady(id) {
  showToast(`Order ${id} marked ready. Notifying nearby riders...`);
  // In real app this would push to delivery portal
}

// Business tabs
document.querySelectorAll('.biz-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.biz-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.biz-panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('biz-' + tab.dataset.biz).classList.add('active');
    if (tab.dataset.biz === 'promote' && typeof renderBizAds === 'function') renderBizAds();
    if (tab.dataset.biz === 'deals' && typeof renderBusiness === 'function') renderBusiness();
  });
});

// ===== RIDER =====
function renderRider() {
  document.getElementById('rider-orders').innerHTML = riderOrders.map(o => `
    <div class="rider-order" id="rider-${o.id}">
      <h4>${o.item}</h4>
      <div class="rider-meta">
        ${o.business} → ${o.address}<br>
        ${o.distance} · Earn GYD ${o.fee}
      </div>
      <div class="rider-actions">
        <button class="decline-btn" onclick="declineOrder('${o.id}')">Decline</button>
        <button class="accept-btn" onclick="acceptOrder('${o.id}')">Accept</button>
      </div>
    </div>
  `).join('');
}

function toggleOnline(el) {
  const on = el.checked;
  document.getElementById('online-label').textContent = on ? "You're Online" : "You're Offline";
  document.getElementById('loc-status').textContent = on ? "On" : "Off";
  document.getElementById('rider-loc-label').textContent = on ? "Online • Georgetown" : "Offline";
}

function acceptOrder(id) {
  const order = riderOrders.find(o => o.id === id);
  if (!order) return;
  
  document.getElementById('rider-' + id)?.remove();
  
  document.getElementById('active-delivery').className = 'active-card has-order';
  document.getElementById('active-delivery').innerHTML = `
    <h4 style="margin-bottom:6px">${order.item}</h4>
    <p class="rider-meta" style="margin-bottom:8px">${order.business} · Earn GYD ${order.fee}</p>
    
    <div class="customer-contact">
      <strong>👤 ${order.customer}</strong>
      <div>📍 ${order.address}</div>
      <div>📞 ${order.phone}</div>
    </div>
    
    <div class="live-loc-row" style="margin:10px 0">
      <span class="live-dot"></span>
      <span>Sharing live location with customer</span>
    </div>
    
    <div class="rider-action-row">
      <a class="btn-nav" href="https://maps.google.com/?q=${encodeURIComponent(order.address)}" target="_blank">🗺️ Navigate</a>
      <a class="btn-call" href="tel:+${order.phone.replace(/-/g,'')}">📞 Call Customer</a>
    </div>
    <button class="btn-done primary-btn" onclick="completeDelivery()">Mark Delivered</button>
  `;
  
  showToast('Order accepted! Live location shared with customer 📍');
}

function declineOrder(id) {
  document.getElementById('rider-' + id)?.remove();
  showToast('Order declined');
}



// ===== UTILITIES =====
function closeModal() {
  document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}

// Close modal on backdrop click
document.querySelectorAll('.modal').forEach(m => {
  m.addEventListener('click', e => {
    if (e.target === m) closeModal();
  });
});

// Init
renderDeals();

// ===== REAL-TIME GPS TRACKING =====
let riderWatchId = null;
let riderMap = null;
let riderMarker = null;
let customerMap = null;
let customerRiderMarker = null;
let currentRiderPos = { lat: 6.8013, lng: -58.1551 }; // Georgetown default
let activeOrderDest = null;
let simInterval = null;

// Haversine distance in km
function distKm(a, b) {
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const x = Math.sin(dLat/2)**2 + Math.cos(a.lat*Math.PI/180) * Math.cos(b.lat*Math.PI/180) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1-x));
}

function etaMinutes(km) {
  // Assume ~25 km/h average in Georgetown traffic
  return Math.max(1, Math.round((km / 25) * 60));
}

function startRiderGPS() {
  if (!navigator.geolocation) {
    showToast('Geolocation not supported on this device');
    // Fall back to Georgetown centre + light simulation
    currentRiderPos = { lat: 6.8013, lng: -58.1551 };
    startSimulation();
    return;
  }

  const opts = { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 };

  // One-shot first fix
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      currentRiderPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      updateRiderMap(currentRiderPos);
      showToast('GPS locked • Live tracking on');
    },
    (err) => {
      console.warn('GPS error', err);
      showToast('Using Georgetown demo location (GPS unavailable)');
      currentRiderPos = { lat: 6.8013, lng: -58.1551 };
      startSimulation();
    },
    opts
  );

  // Continuous watch
  if (riderWatchId) navigator.geolocation.clearWatch(riderWatchId);
  riderWatchId = navigator.geolocation.watchPosition(
    (pos) => {
      currentRiderPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      updateRiderMap(currentRiderPos);
      updateCustomerTrackingMap(currentRiderPos);
    },
    (err) => console.warn('watch error', err),
    opts
  );
}

function stopRiderGPS() {
  if (riderWatchId) {
    navigator.geolocation.clearWatch(riderWatchId);
    riderWatchId = null;
  }
  if (simInterval) {
    clearInterval(simInterval);
    simInterval = null;
  }
}

// Light simulation when real GPS is unavailable (moves toward destination)
function startSimulation() {
  if (simInterval) clearInterval(simInterval);
  simInterval = setInterval(() => {
    if (!activeOrderDest) return;
    const dlat = (activeOrderDest.lat - currentRiderPos.lat) * 0.08;
    const dlng = (activeOrderDest.lng - currentRiderPos.lng) * 0.08;
    // Add tiny jitter
    currentRiderPos = {
      lat: currentRiderPos.lat + dlat + (Math.random()-0.5)*0.0003,
      lng: currentRiderPos.lng + dlng + (Math.random()-0.5)*0.0003
    };
    updateRiderMap(currentRiderPos);
    updateCustomerTrackingMap(currentRiderPos);
  }, 2500);
}

function initMap(containerId, center, zoom = 15) {
  const el = document.getElementById(containerId);
  if (!el || typeof L === 'undefined') return null;
  // Clear previous map instance if any
  if (el._leaflet_id) {
    el._leaflet_id = null;
    el.innerHTML = '';
  }
  const map = L.map(containerId, { zoomControl: false, attributionControl: false }).setView([center.lat, center.lng], zoom);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19
  }).addTo(map);
  setTimeout(() => map.invalidateSize(), 200);
  return map;
}

function riderIcon() {
  return L.divIcon({
    className: 'rider-div-icon',
    html: '<div style="font-size:28px;line-height:1;filter:drop-shadow(0 2px 3px rgba(0,0,0,.3))">🛵</div>',
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  });
}

function destIcon() {
  return L.divIcon({
    className: 'dest-div-icon',
    html: '<div style="font-size:24px;line-height:1">📍</div>',
    iconSize: [28, 28],
    iconAnchor: [14, 28]
  });
}

function updateRiderMap(pos) {
  const wrap = document.getElementById('rider-live-map');
  if (!wrap) return;

  if (!riderMap) {
    riderMap = initMap('rider-live-map', pos, 15);
    if (!riderMap) return;
    riderMarker = L.marker([pos.lat, pos.lng], { icon: riderIcon() }).addTo(riderMap);
    if (activeOrderDest) {
      L.marker([activeOrderDest.lat, activeOrderDest.lng], { icon: destIcon() }).addTo(riderMap);
      const bounds = L.latLngBounds([pos.lat, pos.lng], [activeOrderDest.lat, activeOrderDest.lng]);
      riderMap.fitBounds(bounds.pad(0.35));
    }
  } else {
    riderMarker.setLatLng([pos.lat, pos.lng]);
    riderMap.panTo([pos.lat, pos.lng]);
  }

  // Update coords text
  const coordEl = document.getElementById('rider-coords');
  if (coordEl) {
    coordEl.textContent = `${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}`;
  }
  if (activeOrderDest) {
    const km = distKm(pos, activeOrderDest);
    const eta = etaMinutes(km);
    const etaEl = document.getElementById('rider-eta');
    if (etaEl) etaEl.textContent = `ETA ${eta} min · ${km.toFixed(1)} km`;
  }
}

function updateCustomerTrackingMap(pos) {
  const el = document.getElementById('customer-map');
  if (!el || !document.getElementById('tracking-modal')?.classList.contains('active')) return;

  if (!customerMap) {
    customerMap = initMap('customer-map', pos, 14);
    if (!customerMap) return;
    customerRiderMarker = L.marker([pos.lat, pos.lng], { icon: riderIcon() }).addTo(customerMap);
    if (activeOrderDest) {
      L.marker([activeOrderDest.lat, activeOrderDest.lng], { icon: destIcon() }).addTo(customerMap);
      const bounds = L.latLngBounds([pos.lat, pos.lng], [activeOrderDest.lat, activeOrderDest.lng]);
      customerMap.fitBounds(bounds.pad(0.4));
    }
  } else {
    customerRiderMarker.setLatLng([pos.lat, pos.lng]);
  }

  if (activeOrderDest) {
    const km = distKm(pos, activeOrderDest);
    const eta = etaMinutes(km);
    const etaEl = document.getElementById('track-eta');
    const distEl = document.getElementById('track-distance');
    if (etaEl) etaEl.textContent = `ETA ${eta} min`;
    if (distEl) distEl.textContent = `${km.toFixed(1)} km away`;
  }
}

// Override acceptOrder to include map + GPS
const _origAccept = typeof acceptOrder === 'function' ? acceptOrder : null;

function acceptOrder(id) {
  const order = riderOrders.find(o => o.id === id);
  if (!order) return;

  document.getElementById('rider-' + id)?.remove();
  activeOrderDest = { lat: order.lat || 6.812, lng: order.lng || -58.155 };

  document.getElementById('active-delivery').className = 'active-card has-order';
  document.getElementById('active-delivery').innerHTML = `
    <h4 style="margin-bottom:6px">${order.item}</h4>
    <p class="rider-meta" style="margin-bottom:8px">${order.business} · Earn GYD ${order.fee}</p>
    
    <div class="customer-contact">
      <strong>👤 ${order.customer || 'Customer'}</strong>
      <div>📍 ${order.address}</div>
      <div>📞 ${order.phone || '—'}</div>
    </div>
    
    <div class="rider-map-wrap">
      <div id="rider-live-map" class="gps-map"></div>
      <div class="gps-status">
        <span class="live-dot"></span>
        <span>Live GPS tracking</span>
        <span id="rider-eta" style="margin-left:auto;font-weight:600"></span>
      </div>
      <div class="coords-display" id="rider-coords">Acquiring GPS…</div>
    </div>
    
    <div class="rider-action-row">
      <a class="btn-nav" href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(order.address)}" target="_blank">🗺️ Navigate</a>
      <a class="btn-call" href="tel:+${(order.phone||'').replace(/-/g,'')}">📞 Call Customer</a>
    </div>
    <button class="btn-done primary-btn" onclick="completeDelivery()">Mark Delivered</button>
  `;

  // Reset map instances
  riderMap = null;
  riderMarker = null;

  startRiderGPS();
  // If simulation needed it starts inside startRiderGPS on error
  if (!navigator.geolocation) startSimulation();
  else {
    // Also run light sim toward dest for demo movement even with real GPS
    startSimulation();
  }

  showToast('Order accepted • Live GPS sharing started 📍');
  // Update customer live delivery status
  if (typeof notifyCustomerRiderAccepted === 'function') {
    notifyCustomerRiderAccepted(order.id, {
      name: (currentUser && currentUser.name) || 'Marcus D.',
      phone: (currentUser && currentUser.phone) || '592-671-8801',
      rating: 4.9
    });
  }
}


let podPhotoData = null;

function completeDelivery() {
  // Open proof-of-delivery capture UI instead of finishing immediately
  const panel = document.getElementById('active-delivery');
  if (!panel) return;

  panel.innerHTML = `
    <h4 style="margin-bottom:8px">Proof of Delivery</h4>
    <p class="small" style="margin-bottom:12px">Take a photo of the delivered order (package, doorstep, or customer receiving it).</p>
    
    <div class="pod-capture">
      <div id="pod-preview" class="pod-preview empty">
        <span style="font-size:40px">📷</span>
        <div>No photo yet</div>
      </div>
      <div class="pod-actions">
        <label class="pod-btn camera">
          📸 Take / Choose Photo
          <input type="file" accept="image/*" capture="environment" id="pod-input" onchange="handlePodPhoto(event)" hidden>
        </label>
      </div>
      <div class="form-group" style="margin-top:12px">
        <label>Notes (optional)</label>
        <input type="text" id="pod-notes" placeholder="Left at door, received by customer, etc.">
      </div>
    </div>
    
    <button class="primary-btn" id="pod-confirm-btn" onclick="confirmPod()" disabled style="opacity:0.5;margin-top:12px">
      Confirm Delivery
    </button>
    <button class="decline-btn" style="width:100%;margin-top:8px;padding:11px;border-radius:10px;border:none;font-weight:600" onclick="cancelPod()">
      Cancel
    </button>
  `;
  podPhotoData = null;
}

function handlePodPhoto(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    podPhotoData = e.target.result;
    const preview = document.getElementById('pod-preview');
    preview.classList.remove('empty');
    preview.innerHTML = `<img src="${podPhotoData}" alt="Proof of delivery">`;
    const btn = document.getElementById('pod-confirm-btn');
    if (btn) {
      btn.disabled = false;
      btn.style.opacity = '1';
    }
  };
  reader.readAsDataURL(file);
}

function cancelPod() {
  // Re-show active delivery summary without photo step
  // Simplest: clear and let rider re-accept flow - or rebuild minimal card
  document.getElementById('active-delivery').innerHTML = `
    <p class="small">Photo cancelled. Tap below when ready.</p>
    <button class="btn-done primary-btn" onclick="completeDelivery()">Mark Delivered</button>
  `;
}

async function confirmPod() {
  if (!podPhotoData) {
    showToast('Please take a proof-of-delivery photo first');
    return;
  }
  const notes = document.getElementById('pod-notes')?.value || '';
  const live = typeof getActiveLiveOrder === 'function' ? getActiveLiveOrder() : null;
  const orderId = (window.lastDelivery && window.lastDelivery.orderId) || (live && live.id) || ('DEL-' + Date.now());
  const customerEmail = (live && live.customerEmail) || (window.lastDelivery && window.lastDelivery.customerEmail) || '';
  const customerName = (live && live.customerName) || '';
  const address = (live && live.address) || (window.lastDelivery && window.lastDelivery.address) || 'Delivery address';
  const riderId = (currentUser && (currentUser.id || currentUser.riderId)) || 'rider';
  const riderName = (currentUser && currentUser.name) || 'Rider';

  window.lastPod = {
    photo: podPhotoData,
    notes: notes,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    address: address,
    orderId: orderId
  };

  // Persist proof on server for rider history + email customer
  const payload = {
    orderId,
    riderId,
    riderName,
    customerEmail,
    customerName,
    address,
    notes,
    photoDataUrl: podPhotoData,
    deliveredAt: new Date().toISOString()
  };
  let saved = null;
  if (typeof api === 'function') {
    saved = await api('/api/proofs', { method: 'POST', body: JSON.stringify(payload) });
  }
  // Local backup for rider device
  try {
    const key = 'tgs_pod_history';
    const list = JSON.parse(localStorage.getItem(key) || '[]');
    list.unshift({
      id: (saved && saved.proof && saved.proof.id) || ('POD-' + Date.now()),
      orderId, address, notes, photo: podPhotoData,
      time: window.lastPod.time, deliveredAt: payload.deliveredAt,
      emailSent: !!(saved && saved.emailSent)
    });
    localStorage.setItem(key, JSON.stringify(list.slice(0, 50)));
  } catch (_) {}

  if (typeof notifyCustomerDelivered === 'function') notifyCustomerDelivered(orderId);

  stopRiderGPS();
  activeOrderDest = null;
  riderMap = null;
  customerMap = null;
  podPhotoData = null;

  document.getElementById('active-delivery').className = 'active-card empty';
  document.getElementById('active-delivery').innerHTML = `
    <div style="text-align:center;padding:8px 0">
      <div style="font-size:36px;margin-bottom:6px">✅</div>
      <strong>Delivery complete</strong>
      <p class="small" style="margin-top:6px">Proof saved${saved && saved.emailSent ? ' · emailed to customer' : ' · on file for your records'}</p>
    </div>
  `;
  showToast(saved && saved.emailSent
    ? 'Delivery confirmed — proof emailed to customer 📧'
    : 'Delivery confirmed — proof saved for your records 📸');
  if (typeof loadPodHistory === 'function') loadPodHistory();

  setTimeout(() => {
    if (document.getElementById('tracking-modal')?.classList.contains('active')) {
      showRiderRatingUI();
    }
  }, 500);

  setTimeout(() => {
    const track = document.getElementById('tracking-modal');
    if (track) {
      if (typeof setTrackStatusSteps === 'function') setTrackStatusSteps('delivered');
      let podBox = document.getElementById('pod-customer-view');
      if (!podBox) {
        podBox = document.createElement('div');
        podBox.id = 'pod-customer-view';
        podBox.className = 'pod-customer-box';
        track.querySelector('.modal-content')?.appendChild(podBox);
      }
      if (window.lastPod) {
        podBox.innerHTML = `
          <strong>Proof of Delivery</strong>
          <img src="${window.lastPod.photo}" alt="POD">
          <div class="small">Delivered at ${window.lastPod.time}${window.lastPod.notes ? ' · ' + window.lastPod.notes : ''}</div>
        `;
      }
    }
  }, 300);
}

async function loadPodHistory() {
  const el = document.getElementById('pod-history');
  if (!el) return;
  let list = [];
  const riderId = currentUser && (currentUser.id || currentUser.riderId);
  if (typeof api === 'function' && riderId) {
    const res = await api('/api/proofs?riderId=' + encodeURIComponent(riderId));
    if (res && res.proofs) list = res.proofs;
  }
  if (!list.length) {
    try { list = JSON.parse(localStorage.getItem('tgs_pod_history') || '[]'); } catch (_) { list = []; }
  }
  if (!list.length) {
    el.innerHTML = '<p class="small" style="color:var(--muted)">No delivery proofs yet. They appear here after you complete a delivery with a photo.</p>';
    return;
  }
  el.innerHTML = list.map(p => `
    <div class="pod-history-card">
      <img src="${p.photoUrl || p.photo || ''}" alt="POD" onerror="this.style.display='none'">
      <div>
        <strong>${p.orderId || 'Delivery'}</strong>
        <div class="meta">${p.address || ''}</div>
        <div class="meta">${p.deliveredAt ? new Date(p.deliveredAt).toLocaleString() : (p.time || '')}</div>
        ${p.notes ? `<div class="meta">📝 ${p.notes}</div>` : ''}
      </div>
    </div>
  `).join('');
}



// When customer tracking modal opens, init map
const _origPlaceOrder = placeOrder;
placeOrder = function() {
  const isDelivery = document.querySelector('input[name="fulfillment"]:checked')?.value === 'delivery';
  if (isDelivery) {
    const addr = document.getElementById('delivery-address')?.value?.trim();
    const phone = document.getElementById('delivery-phone')?.value?.trim();
    if (!addr || !phone) {
      showToast('Please enter delivery address and contact number');
      return;
    }
    window.lastDelivery = { address: addr, phone: phone };
    if (typeof createLiveOrder === 'function' && isDelivery) {
      const totalEl = document.getElementById('cart-total');
      const totalTxt = totalEl ? totalEl.textContent.replace(/[^0-9]/g, '') : '0';
      const live = createLiveOrder({
        item: (cart && cart[0]) ? cart.map(x => x.title || x.name || 'Item').join(', ') : 'Delivery order',
        total: parseInt(totalTxt, 10) || 0,
        address: addr,
        phone: phone
      });
      window.activeTrackOrderId = live.id;
      window.lastDelivery.orderId = live.id;
    }
    // Use a Georgetown destination near the sample points
    activeOrderDest = { lat: 6.812, lng: -58.155 };
  }
  cart = [];
  updateCartCount();
  closeModal();
  if (isDelivery) {
    showToast('Order placed! Rider will share live location 🛵');
    setTimeout(() => {
      if (window.lastDelivery) {
        document.getElementById('track-address').textContent = window.lastDelivery.address;
        document.getElementById('track-phone').textContent = 'Contact: ' + window.lastDelivery.phone;
        customerMap = null;
        customerRiderMarker = null;
        document.getElementById('tracking-modal').classList.add('active');
        // Start from a nearby point and animate
        currentRiderPos = { lat: 6.8013, lng: -58.1551 };
        setTimeout(() => {
          updateCustomerTrackingMap(currentRiderPos);
          startSimulation();
        }, 400);
      }
    }, 1500);
  } else {
    showToast('Order placed! Show your voucher in-store 🎁');
  }
};

function toggleOnline(el) {
  const on = el.checked;
  document.getElementById('online-label').textContent = on ? "You're Online" : "You're Offline";
  document.getElementById('loc-status').textContent = on ? "On" : "Off";
  document.getElementById('rider-loc-label').textContent = on ? "Online • Georgetown" : "Offline";
  if (!on) stopRiderGPS();
}




// Customer tab switching (Home / Profile)
function showCustomerTab(tab) {
  document.querySelectorAll('.bottom-nav .nav-item').forEach(n => n.classList.remove('active'));
  const btn = document.querySelector(`.bottom-nav .nav-item[data-tab="${tab}"]`);
  if (btn) btn.classList.add('active');

  const feed = document.getElementById('deals-feed');
  const cats = document.querySelector('.categories');
  const search = document.querySelector('.search-bar');
  const profile = document.getElementById('profile-panel');

  const ordersPanel = document.getElementById('orders-panel');
  const adBanner = document.getElementById('customer-ad-banner');

  if (tab === 'profile') {
    if (feed) feed.classList.add('hidden');
    if (cats) cats.classList.add('hidden');
    if (search) search.classList.add('hidden');
    if (ordersPanel) ordersPanel.classList.add('hidden');
    if (adBanner) adBanner.classList.add('hidden');
    if (profile) profile.classList.remove('hidden');
  } else if (tab === 'orders') {
    if (feed) feed.classList.add('hidden');
    if (cats) cats.classList.add('hidden');
    if (search) search.classList.add('hidden');
    if (profile) profile.classList.add('hidden');
    if (adBanner) adBanner.classList.add('hidden');
    if (ordersPanel) ordersPanel.classList.remove('hidden');
    renderCustomerOrders();
    updateLiveTrackBanner();
  } else {
    if (feed) feed.classList.remove('hidden');
    if (cats) cats.classList.remove('hidden');
    if (search) search.classList.remove('hidden');
    if (profile) profile.classList.add('hidden');
    if (ordersPanel) ordersPanel.classList.add('hidden');
    if (adBanner) adBanner.classList.remove('hidden');
    if (tab === 'saved') {
      showToast('Saved deals coming soon');
    }
  }
}


// ===== LOCAL PAYMENT METHODS =====
document.addEventListener('change', (e) => {
  if (e.target.name === 'pay-method') {
    showPayPanel(e.target.value);
  }
});

function showPayPanel(method) {
  ['mmg-panel', 'bank-panel', 'card-panel'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });
  const btn = document.getElementById('place-order-btn');
  if (method === 'mmg') {
    document.getElementById('mmg-panel')?.classList.remove('hidden');
    if (btn) btn.textContent = 'Pay with MMG';
  } else if (method === 'bank') {
    document.getElementById('bank-panel')?.classList.remove('hidden');
    if (btn) btn.textContent = 'Confirm – I will transfer';
  } else if (method === 'card') {
    document.getElementById('card-panel')?.classList.remove('hidden');
    if (btn) btn.textContent = 'Pay by Card';
  } else {
    if (btn) btn.textContent = 'Place Order';
  }
}

// Wrap / enhance placeOrder to handle payment method
const _placeOrderBase = typeof placeOrder === 'function' ? placeOrder : null;

placeOrder = function() {
  const isDelivery = document.querySelector('input[name="fulfillment"]:checked')?.value === 'delivery';
  const payMethod = document.querySelector('input[name="pay-method"]:checked')?.value || 'cod';

  if (isDelivery) {
    const addr = document.getElementById('delivery-address')?.value?.trim();
    const phone = document.getElementById('delivery-phone')?.value?.trim();
    if (!addr || !phone) {
      showToast('Please enter delivery address and contact number');
      return;
    }
    window.lastDelivery = { address: addr, phone: phone };
    if (typeof createLiveOrder === 'function' && isDelivery) {
      const totalEl = document.getElementById('cart-total');
      const totalTxt = totalEl ? totalEl.textContent.replace(/[^0-9]/g, '') : '0';
      const live = createLiveOrder({
        item: (cart && cart[0]) ? cart.map(x => x.title || x.name || 'Item').join(', ') : 'Delivery order',
        total: parseInt(totalTxt, 10) || 0,
        address: addr,
        phone: phone
      });
      window.activeTrackOrderId = live.id;
      window.lastDelivery.orderId = live.id;
    }
    activeOrderDest = { lat: 6.812, lng: -58.155 };
  }

  // Payment-specific validation / simulation
  if (payMethod === 'mmg') {
    const mmgPhone = document.getElementById('mmg-phone')?.value?.trim();
    if (!mmgPhone) {
      showToast('Enter your MMG phone number');
      return;
    }
    showToast('Opening MMG… confirm payment in the MMG app');
    setTimeout(() => showToast('MMG payment received ✓'), 1600);
  } else if (payMethod === 'bank') {
    showToast('Order placed. Transfer using the reference shown. We confirm when funds arrive.');
  } else if (payMethod === 'card') {
    showToast('Redirecting to secure card page…');
    setTimeout(() => showToast('Card payment successful ✓'), 1500);
  } else {
    // COD
    if (isDelivery) {
      showToast('Order placed! Pay cash to the rider on delivery 💵');
    } else {
      showToast('Order placed! Pay in-store when you collect 🎁');
    }
  }

  cart = [];
  updateCartCount();
  closeModal();

  // Delivery tracking after short delay for paid/COD delivery
  if (isDelivery && (payMethod === 'cod' || payMethod === 'mmg' || payMethod === 'card' || payMethod === 'bank')) {
    setTimeout(() => {
      if (window.lastDelivery) {
        customerMap = null;
        customerRiderMarker = null;
        openTrackingWithRider(window.lastDelivery.address, window.lastDelivery.phone);
      }
    }, 2000);
  }
};

// ===== ASSIGNED RIDER INFO (shown to customer) =====
const sampleRiders = [
  { id: "R1", name: "Marcus D.", phone: "592-671-8801", rating: 4.9, ratingCount: 128, avatar: "🧔" },
  { id: "R2", name: "Aisha K.", phone: "592-624-3390", rating: 4.8, ratingCount: 95, avatar: "👩" },
  { id: "R3", name: "Ryan P.", phone: "592-612-7742", rating: 5.0, ratingCount: 64, avatar: "👨" },
  { id: "R4", name: "Keisha B.", phone: "592-645-1128", rating: 4.7, ratingCount: 112, avatar: "👩‍🦱" }
];

let assignedRider = sampleRiders[0];
let selectedStars = 0;
const riderRatingsLog = []; // local log of submitted ratings

function formatRiderRating(r) {
  return r.rating.toFixed(1) + ' ★ (' + r.ratingCount + ')';
}

function setTrackingRider(rider) {
  assignedRider = rider || sampleRiders[Math.floor(Math.random() * sampleRiders.length)];
  const nameEl = document.getElementById('track-rider-name');
  const phoneEl = document.getElementById('track-rider-phone');
  const callBtn = document.getElementById('track-rider-call-btn');
  const ratingEl = document.getElementById('track-rider-rating');
  const avatarEl = document.getElementById('track-rider-avatar');
  const rateName = document.getElementById('rate-rider-name');
  if (nameEl) nameEl.textContent = assignedRider.name;
  if (ratingEl) ratingEl.textContent = formatRiderRating(assignedRider);
  if (avatarEl) avatarEl.textContent = assignedRider.avatar;
  if (rateName) rateName.textContent = assignedRider.name;
  const tel = '+' + assignedRider.phone.replace(/-/g, '');
  if (phoneEl) {
    phoneEl.textContent = assignedRider.phone;
    phoneEl.href = 'tel:' + tel;
  }
  if (callBtn) callBtn.href = 'tel:' + tel;
  // reset rating UI when assigning
  selectedStars = 0;
  document.querySelectorAll('.star-btn').forEach(b => b.classList.remove('active'));
  const submitBtn = document.getElementById('submit-rating-btn');
  if (submitBtn) { submitBtn.disabled = true; submitBtn.style.opacity = '0.5'; }
  document.getElementById('rider-rating-panel')?.classList.add('hidden');
  document.getElementById('rating-thanks')?.classList.add('hidden');
  const comment = document.getElementById('rating-comment');
  if (comment) comment.value = '';
}

function openTrackingWithRider(address, customerPhone) {
  setTrackingRider();
  if (address) document.getElementById('track-address').textContent = address;
  if (customerPhone) document.getElementById('track-phone').textContent = 'Your contact: ' + customerPhone;
  // Live status steps from active order if available
  const live = (typeof getActiveLiveOrder === 'function' && getActiveLiveOrder()) ||
    (window.activeTrackOrderId && customerLiveOrders.find(o => o.id === window.activeTrackOrderId));
  if (typeof setTrackStatusSteps === 'function') {
    setTrackStatusSteps(live ? live.status : 'confirmed');
  }
  document.getElementById('tracking-modal')?.classList.add('active');
  currentRiderPos = { lat: 6.8013, lng: -58.1551 };
  activeOrderDest = activeOrderDest || { lat: 6.812, lng: -58.155 };
  setTimeout(() => {
    if (typeof updateCustomerTrackingMap === 'function') {
      updateCustomerTrackingMap(currentRiderPos);
      if (typeof startSimulation === 'function') startSimulation();
    }
  }, 400);
}

// Star selection
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.star-btn');
  if (!btn) return;
  selectedStars = parseInt(btn.dataset.star, 10);
  document.querySelectorAll('.star-btn').forEach(b => {
    b.classList.toggle('active', parseInt(b.dataset.star, 10) <= selectedStars);
  });
  const submitBtn = document.getElementById('submit-rating-btn');
  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.style.opacity = '1';
  }
});

function showRiderRatingUI() {
  // Mark status steps as delivered
  document.querySelectorAll('#tracking-modal .status-step').forEach(s => s.classList.add('active'));
  const panel = document.getElementById('rider-rating-panel');
  const thanks = document.getElementById('rating-thanks');
  if (thanks) thanks.classList.add('hidden');
  if (panel) {
    panel.classList.remove('hidden');
    const nameEl = document.getElementById('rate-rider-name');
    if (nameEl && assignedRider) nameEl.textContent = assignedRider.name;
  }
  // Hide live map overlay noise a bit - optional
  const eta = document.getElementById('track-eta');
  const dist = document.getElementById('track-distance');
  if (eta) eta.textContent = 'Delivered';
  if (dist) dist.textContent = '0 km';
}

function submitRiderRating() {
  if (!selectedStars || !assignedRider) {
    showToast('Please select a star rating');
    return;
  }
  const comment = document.getElementById('rating-comment')?.value?.trim() || '';
  // Update running average
  const oldTotal = assignedRider.rating * assignedRider.ratingCount;
  assignedRider.ratingCount += 1;
  assignedRider.rating = Math.round(((oldTotal + selectedStars) / assignedRider.ratingCount) * 10) / 10;
  // Persist on sample list
  const idx = sampleRiders.findIndex(r => r.id === assignedRider.id);
  if (idx >= 0) sampleRiders[idx] = { ...assignedRider };

  riderRatingsLog.push({
    riderId: assignedRider.id,
    riderName: assignedRider.name,
    stars: selectedStars,
    comment,
    at: new Date().toISOString()
  });

  // Refresh displayed rating
  const ratingEl = document.getElementById('track-rider-rating');
  if (ratingEl) ratingEl.textContent = formatRiderRating(assignedRider);

  document.getElementById('rider-rating-panel')?.classList.add('hidden');
  const thanks = document.getElementById('rating-thanks');
  if (thanks) {
    thanks.classList.remove('hidden');
    const detail = document.getElementById('rating-thanks-detail');
    if (detail) {
      detail.textContent = selectedStars + ' star' + (selectedStars > 1 ? 's' : '') +
        ' for ' + assignedRider.name +
        (comment ? ' — "' + comment + '"' : '');
    }
  }
  showToast('Rating submitted — thank you! ⭐');
}

/** Demo helper: mark current tracked order as delivered so rating appears */
function markOrderDeliveredForRating() {
  if (typeof notifyCustomerDelivered === 'function') notifyCustomerDelivered();

  if (typeof stopRiderGPS === 'function') stopRiderGPS();
  showRiderRatingUI();
  showToast('Order delivered — please rate your rider');
}






// Try backend when placing order
async function placeOrderViaAPI(payload) {
  return api("/api/orders", { method: "POST", body: JSON.stringify(payload) });
}

async function submitRiderRatingViaAPI(riderId, stars, comment) {
  return api("/api/ratings", {
    method: "POST",
    body: JSON.stringify({ riderId, stars, comment })
  });
}






// ===== MANAGER PORTAL =====
function applyPlatformAds() {
  const loginAd = platformAds.find(a => a.status === 'Active' && (a.place === 'login' || a.place === 'both'));
  const custAd = platformAds.find(a => a.status === 'Active' && (a.place === 'customer' || a.place === 'both'));
  // Login banner
  const loginBanner = document.querySelector('#login-screen .ad-banner');
  if (loginBanner && loginAd) {
    loginBanner.querySelector('.ad-body strong').textContent = loginAd.headline;
    loginBanner.querySelector('.ad-body span').textContent = loginAd.sub;
    loginBanner.style.display = '';
  } else if (loginBanner && !loginAd) {
    loginBanner.style.display = 'none';
  }
  // Customer banner
  const custBanner = document.getElementById('customer-ad-banner');
  if (custBanner && custAd) {
    custBanner.querySelector('.ad-body strong').textContent = custAd.headline;
    custBanner.querySelector('.ad-body span').textContent = custAd.sub;
    custBanner.style.display = '';
  } else if (custBanner && !custAd) {
    custBanner.style.display = 'none';
  }
}

function showMgrTab(tab) {
  document.querySelectorAll('.mgr-tabs .biz-tab').forEach(t => t.classList.toggle('active', t.dataset.mgr === tab));
  ['overview','activity','payments','reports','ads','businesses','customers','riders'].forEach(id => {
    const el = document.getElementById('mgr-' + id);
    if (el) el.classList.toggle('active', id === tab);
  });
  renderManager();
}

function renderManager() {
  syncManagerWithLiveApp();

  const biz = adminUsers.filter(u => u.role === 'business');
  const cust = adminUsers.filter(u => u.role === 'customer');
  const ridersList = adminUsers.filter(u => u.role === 'delivery');
  const adsActive = platformAds.filter(a => a.status === 'Active');
  const liveDeals = (typeof deals !== 'undefined' ? deals : []).filter(d => !d._paused);
  const orderCount = (typeof incomingOrders !== 'undefined' ? incomingOrders.length : 0)
    + (typeof orders !== 'undefined' && Array.isArray(orders) ? orders.length : 0);

  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('mgr-stat-biz', biz.length);
  set('mgr-stat-cust', cust.length);
  set('mgr-stat-riders', ridersList.length);
  set('mgr-stat-ads', adsActive.length);
  set('mgr-stat-deals', liveDeals.length);
  set('mgr-stat-orders', orderCount || (typeof incomingOrders !== 'undefined' ? incomingOrders.length : 0));

  const fmt = n => 'GYD ' + (n || 0).toLocaleString();
  set('mgr-rev-sub', fmt(platformRevenue.subscriptions));
  set('mgr-rev-ads', fmt(platformRevenue.ads));
  set('mgr-rev-total', fmt((platformRevenue.subscriptions || 0) + (platformRevenue.ads || 0)));

  // Live snapshot
  const snap = document.getElementById('mgr-live-snapshot');
  if (snap) {
    const trialBiz = biz.filter(u => (u.subscription || 'trial') === 'trial').length;
    const paidBiz = biz.filter(u => u.subscription === 'paid').length;
    snap.innerHTML = `
      <div class="activity-item">📦 <strong>${liveDeals.length}</strong> deals live in customer feed</div>
      <div class="activity-item">🏪 <strong>${biz.length}</strong> businesses · ${paidBiz} paid · ${trialBiz} trial</div>
      <div class="activity-item">📢 <strong>${adsActive.length}</strong> active ads (login + customer)</div>
      <div class="activity-item">💰 Revenue — Subs ${fmt(platformRevenue.subscriptions)} · Ads ${fmt(platformRevenue.ads)}</div>
      <div class="activity-item">🛵 <strong>${ridersList.length}</strong> riders · <strong>${cust.length}</strong> customers</div>
    `;
  }

  // Deals snapshot from live `deals` array
  const dealsSnap = document.getElementById('mgr-deals-snapshot');
  if (dealsSnap) {
    if (!liveDeals.length) {
      dealsSnap.innerHTML = '<p class="small">No live deals</p>';
    } else {
      dealsSnap.innerHTML = liveDeals.slice(0, 12).map(d => `
        <div class="mgr-row">
          <h4>${d.emoji || ''} ${d.title}</h4>
          <div class="meta">${d.business} · GYD ${(d.price || 0).toLocaleString()} · ${d.category || ''}${d._paused ? ' · PAUSED' : ''}</div>
        </div>
      `).join('');
    }
  }

  // Ads list
  const adList = document.getElementById('mgr-ad-list');
  if (adList) {
    adList.innerHTML = platformAds.map(a => `
      <div class="mgr-row">
        <h4>${a.headline}</h4>
        <div class="meta">${a.sub || ''} · ${a.place} · <strong>${a.status}</strong>${a.business ? ' · ' + a.business : ''}${a.source ? ' · ' + a.source : ''}</div>
        <div class="mgr-actions">
          <button type="button" class="btn-edit" onclick="openMgrAdForm('${a.id}')">✏️ Edit</button>
          <button type="button" onclick="toggleMgrAd('${a.id}')">${a.status === 'Active' ? '⏸ Pause' : '▶ Resume'}</button>
          <button type="button" class="btn-del" onclick="deleteMgrAd('${a.id}')">🗑 Delete</button>
        </div>
      </div>
    `).join('') || '<p class="small">No ads yet</p>';
  }

  const subLabel = (u) => {
    if (u.role === 'business') {
      const s = u.subscription || 'trial';
      if (s === 'paid') return 'Subscription: Paid' + (u.paidUntil ? ' until ' + new Date(u.paidUntil).toLocaleDateString() : '');
      if (s === 'expired') return 'Subscription: Expired';
      return 'Subscription: Free trial';
    }
    if (u.role === 'customer') return 'Plan: Customer (free)';
    if (u.role === 'delivery') return 'Plan: Rider (free)';
    return '';
  };

  const renderUserList = (role, elId) => {
    const el = document.getElementById(elId);
    if (!el) return;
    const list = adminUsers.filter(u => u.role === role);
    el.innerHTML = list.map(u => {
      const logo = (u.logo || (u.businessName && businessLogos[u.businessName])) || null;
      return `
      <div class="mgr-row">
        <div style="display:flex;gap:10px;align-items:flex-start">
          ${role === 'business' ? (logo
            ? `<img src="${logo}" alt="" style="width:40px;height:40px;border-radius:10px;object-fit:cover">`
            : `<div style="width:40px;height:40px;border-radius:10px;background:#f3f4f6;display:flex;align-items:center;justify-content:center">🏪</div>`) : ''}
          <div style="flex:1">
            <h4>${u.name}${u.businessName ? ' · ' + u.businessName : ''}</h4>
            <div class="meta">${u.identifier}${u.phone ? ' · ' + u.phone : ''}</div>
            <div class="meta"><strong>${subLabel(u)}</strong></div>
          </div>
        </div>
        <div class="mgr-actions" style="margin-top:8px">
          <button type="button" class="btn-edit" onclick="openMgrUserForm('${role}','${u.id}')">✏️ Edit</button>
          <button type="button" class="btn-del" onclick="deleteMgrUser('${u.id}')">🗑 Delete</button>
        </div>
      </div>`;
    }).join('') || '<p class="small">No records</p>';
  };
  renderUserList('business', 'mgr-biz-list');
  renderUserList('customer', 'mgr-cust-list');
  renderUserList('delivery', 'mgr-rider-list');

  // Activity feed
  const actList = document.getElementById('mgr-activity-list');
  if (actList) {
    const items = platformActivity.length ? platformActivity : [
      { type: 'info', message: 'No activity yet — sign-ups, payments and ads will appear here.', at: new Date().toISOString() }
    ];
    actList.innerHTML = items.slice(0, 80).map(a => `
      <div class="activity-item">
        <strong>${(a.type || 'info').toUpperCase()}</strong> · ${a.message}
        <div class="small">${a.at ? new Date(a.at).toLocaleString() : ''}</div>
      </div>
    `).join('');
  }

  // Payments & subscribers
  const fmt2 = n => 'GYD ' + (n || 0).toLocaleString();
  const set2 = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set2('mgr-pay-sub', fmt2(platformRevenue.subscriptions));
  set2('mgr-pay-ads', fmt2(platformRevenue.ads));
  set2('mgr-pay-total', fmt2((platformRevenue.subscriptions || 0) + (platformRevenue.ads || 0)));
  const paidSubs = adminUsers.filter(u => u.role === 'business' && u.subscription === 'paid');
  set2('mgr-pay-recurring', String(paidSubs.length));

  const subList = document.getElementById('mgr-subscribers-list');
  if (subList) {
    subList.innerHTML = paidSubs.length ? paidSubs.map(u => `
      <div class="mgr-row">
        <h4>${u.businessName || u.name}</h4>
        <div class="meta">${u.email || u.identifier || ''} · Paid until ${u.paidUntil ? new Date(u.paidUntil).toLocaleDateString() : '—'}</div>
        <div class="meta"><strong>Recurring · GYD 5,000 / month via MMG 6124940</strong></div>
      </div>
    `).join('') : '<p class="small">No active paid subscribers yet</p>';
  }

  const payList = document.getElementById('mgr-payments-list');
  if (payList) {
    payList.innerHTML = paymentLedger.length ? paymentLedger.slice(0, 50).map(p => `
      <div class="mgr-row">
        <h4>${p.kind === 'subscription' ? '🔄 Subscription' : '📢 Ad placement'}</h4>
        <div class="meta">${p.detail || ''}</div>
        <div class="meta"><strong>GYD ${(p.amount || 0).toLocaleString()}</strong> · ${p.at ? new Date(p.at).toLocaleString() : ''}</div>
      </div>
    `).join('') : '<p class="small">No payment transactions recorded yet</p>';
  }

  // Daily & monthly reports
  const now = new Date();
  const dayKey = (d) => new Date(d).toDateString();
  const monthKey = (d) => new Date(d).getFullYear() + '-' + String(new Date(d).getMonth() + 1).padStart(2, '0');
  const today = now.toDateString();
  const thisMonth = monthKey(now);

  const paysToday = paymentLedger.filter(p => p.at && dayKey(p.at) === today);
  const paysMonth = paymentLedger.filter(p => p.at && monthKey(p.at) === thisMonth);
  const sum = (arr) => arr.reduce((s, p) => s + (p.amount || 0), 0);
  const signupsToday = platformActivity.filter(a => a.type === 'signup' && a.at && dayKey(a.at) === today).length;
  const ordersToday = (typeof customerLiveOrders !== 'undefined' ? customerLiveOrders : []).filter(o => o.createdAt && dayKey(o.createdAt) === today).length;

  set2('mgr-rep-today', fmt2(sum(paysToday)));
  set2('mgr-rep-month', fmt2(sum(paysMonth)));
  set2('mgr-rep-signups', String(signupsToday));
  set2('mgr-rep-orders', String(ordersToday));

  const dailyEl = document.getElementById('mgr-daily-report');
  if (dailyEl) {
    dailyEl.innerHTML = `
      <div class="activity-item">📅 <strong>Today</strong> · ${today}</div>
      <div class="activity-item">💰 Income: <strong>${fmt2(sum(paysToday))}</strong> (${paysToday.length} payments)</div>
      <div class="activity-item">🔄 Subscriptions today: ${paysToday.filter(p => p.kind === 'subscription').length}</div>
      <div class="activity-item">📢 Ad placements today: ${paysToday.filter(p => p.kind === 'ad').length}</div>
      <div class="activity-item">👤 New sign-ups: ${signupsToday}</div>
      <div class="activity-item">📦 Orders placed: ${ordersToday}</div>
      <div class="activity-item">🏪 Businesses total: ${biz.length} · Paid recurring: ${paidSubs.length}</div>
      <div class="activity-item">🛵 Riders: ${ridersList.length} · Customers: ${cust.length}</div>
    `;
  }

  const monthlyEl = document.getElementById('mgr-monthly-report');
  if (monthlyEl) {
    const subM = paysMonth.filter(p => p.kind === 'subscription');
    const adM = paysMonth.filter(p => p.kind === 'ad');
    const signupsMonth = platformActivity.filter(a => a.type === 'signup' && a.at && monthKey(a.at) === thisMonth).length;
    monthlyEl.innerHTML = `
      <div class="activity-item">🗓 <strong>Month</strong> · ${thisMonth}</div>
      <div class="activity-item">💰 Total income: <strong>${fmt2(sum(paysMonth))}</strong></div>
      <div class="activity-item">🔄 Subscription revenue: <strong>${fmt2(sum(subM))}</strong> (${subM.length} payments)</div>
      <div class="activity-item">📢 Ad revenue: <strong>${fmt2(sum(adM))}</strong> (${adM.length} placements)</div>
      <div class="activity-item">👤 Sign-ups this month: ${signupsMonth}</div>
      <div class="activity-item">📊 Active paid subscribers: ${paidSubs.length}</div>
      <div class="activity-item">📢 Active ads: ${adsActive.length}</div>
      <div class="activity-item">📦 Live deals in feed: ${liveDeals.length}</div>
    `;
  }

  applyPlatformAds();
}

function openMgrAdForm(id) {
  const ad = id ? platformAds.find(a => a.id === id) : null;
  document.getElementById('mgr-ad-id').value = ad ? ad.id : '';
  document.getElementById('mgr-ad-title').textContent = ad ? 'Edit Ad' : 'New Ad';
  document.getElementById('mgr-ad-save').textContent = ad ? 'Update Ad' : 'Save Ad';
  document.getElementById('mgr-ad-headline').value = ad ? ad.headline : '';
  document.getElementById('mgr-ad-sub').value = ad ? ad.sub : '';
  document.getElementById('mgr-ad-place').value = ad ? ad.place : 'both';
  document.getElementById('mgr-ad-status').value = ad ? ad.status : 'Active';
  document.getElementById('mgr-ad-modal')?.classList.add('active');
}

function saveMgrAd(e) {
  e.preventDefault();
  const id = document.getElementById('mgr-ad-id').value;
  const headline = document.getElementById('mgr-ad-headline').value.trim();
  const sub = document.getElementById('mgr-ad-sub').value.trim();
  const place = document.getElementById('mgr-ad-place').value;
  const status = document.getElementById('mgr-ad-status').value;
  if (!headline) { showToast('Headline required'); return false; }
  if (id) {
    const ad = platformAds.find(a => a.id === id);
    if (ad) { ad.headline = headline; ad.sub = sub; ad.place = place; ad.status = status; }
    showToast('Ad updated');
  } else {
    platformAds.unshift({ id: 'AD' + Date.now().toString(36).toUpperCase(), headline, sub, place, status });
    showToast('Ad created');
  }
  persistAdminData();
  closeModal();
  renderManager();
  applyPlatformAds();
  return false;
}

function toggleMgrAd(id) {
  const ad = platformAds.find(a => a.id === id);
  if (!ad) return;
  ad.status = ad.status === 'Active' ? 'Paused' : 'Active';
  persistAdminData();
  renderManager();
  applyPlatformAds();
  showToast(ad.status === 'Active' ? 'Ad resumed' : 'Ad paused');
}

function deleteMgrAd(id) {
  if (!confirm('Delete this ad?')) return;
  platformAds = platformAds.filter(a => a.id !== id);
  persistAdminData();
  renderManager();
  applyPlatformAds();
  showToast('Ad deleted');
}

function openMgrUserForm(role, id) {
  const u = id ? adminUsers.find(x => x.id === id) : null;
  document.getElementById('mgr-user-id').value = u ? u.id : '';
  document.getElementById('mgr-user-role').value = role;
  document.getElementById('mgr-user-title').textContent = (u ? 'Edit ' : 'Add ') + role;
  document.getElementById('mgr-user-save').textContent = u ? 'Update' : 'Save';
  document.getElementById('mgr-user-name').value = u ? u.name : '';
  document.getElementById('mgr-user-identifier').value = u ? u.identifier : '';
  document.getElementById('mgr-user-password').value = u ? '' : 'giftshop';
  const bizG = document.getElementById('mgr-user-biz-group');
  if (bizG) bizG.style.display = role === 'business' ? 'block' : 'none';
  document.getElementById('mgr-user-business').value = u && u.businessName ? u.businessName : '';
  document.getElementById('mgr-user-modal')?.classList.add('active');
}

function saveMgrUser(e) {
  e.preventDefault();
  const id = document.getElementById('mgr-user-id').value;
  const role = document.getElementById('mgr-user-role').value;
  const name = document.getElementById('mgr-user-name').value.trim();
  const identifier = document.getElementById('mgr-user-identifier').value.trim();
  const password = document.getElementById('mgr-user-password').value;
  const businessName = document.getElementById('mgr-user-business').value.trim();
  if (!name || !identifier) { showToast('Name and phone/email required'); return false; }
  if (id) {
    const u = adminUsers.find(x => x.id === id);
    if (u) {
      u.name = name; u.identifier = identifier;
      if (password) u.password = password;
      if (role === 'business') u.businessName = businessName;
    }
    showToast('Updated — tap Save to persist');
  } else {
    adminUsers.push({
      id: 'U' + Date.now().toString(36).toUpperCase(),
      name, identifier, role,
      phone: identifier.includes('@') ? '' : identifier,
      email: identifier.includes('@') ? identifier : '',
      password: password || 'giftshop',
      businessName: role === 'business' ? businessName : undefined,
      subscription: role === 'business' ? 'trial' : 'n/a'
    });
    showToast('Created — tap Save to persist');
  }
  persistAdminData();
  closeModal();
  renderManager();
  return false;
}

function deleteMgrUser(id) {
  const u = adminUsers.find(x => x.id === id);
  if (!u) return;
  if (u.role === 'manager') { showToast('Cannot delete manager account'); return; }
  if (!confirm('Delete ' + u.name + '?')) return;
  adminUsers = adminUsers.filter(x => x.id !== id);
  persistAdminData();
  renderManager();
  showToast('Deleted');
}

// Call applyPlatformAds on login screen show
const _startLoginOrig = typeof startLogin === 'function' ? startLogin : null;



// ===== BUSINESS PROMOTE ADS =====
function selectAdPlan(el) {
  document.querySelectorAll('.ad-price-opt').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
  selectedAdPlan = el.dataset.plan;
  const amt = selectedAdPlan === 'week' ? 5000 : 1000;
  const elAmt = document.getElementById('biz-ad-amount');
  if (elAmt) elAmt.textContent = 'GYD ' + amt.toLocaleString();
}

function openBizAdComposer() {
  document.getElementById('biz-ad-headline').value = '';
  document.getElementById('biz-ad-sub').value = '';
  document.getElementById('biz-ad-place').value = 'customer';
  document.getElementById('biz-ad-mmg').value = '';
  document.getElementById('biz-ad-txid').value = '';
  selectedAdPlan = 'day';
  document.querySelectorAll('.ad-price-opt').forEach(o => {
    o.classList.toggle('selected', o.dataset.plan === 'day');
  });
  const elAmt = document.getElementById('biz-ad-amount');
  if (elAmt) elAmt.textContent = 'GYD 1,000';
  document.getElementById('biz-ad-modal')?.classList.add('active');
}

function submitBizAd(e) {
  e.preventDefault();
  const headline = document.getElementById('biz-ad-headline').value.trim();
  const sub = document.getElementById('biz-ad-sub').value.trim();
  const place = document.getElementById('biz-ad-place').value;
  const mmg = document.getElementById('biz-ad-mmg').value.trim();
  const txid = document.getElementById('biz-ad-txid').value.trim();
  if (!headline) { showToast('Enter a headline'); return false; }
  if (mmg.length < 7 || txid.length < 4) {
    showToast('Enter MMG phone and transaction ID after paying');
    return false;
  }
  const amount = selectedAdPlan === 'week' ? 5000 : 1000;
  const days = selectedAdPlan === 'week' ? 7 : 1;
  const ends = new Date();
  ends.setDate(ends.getDate() + days);
  const bizName = (currentUser && currentUser.businessName) || 'Local Business';

  const ad = {
    id: 'BAD' + Date.now().toString(36).toUpperCase(),
    headline,
    sub: sub || (bizName + ' on The Gift Shop'),
    place,
    status: 'Active',
    amount,
    days,
    ends: ends.toISOString(),
    mmg,
    txid,
    business: bizName,
    createdAt: new Date().toISOString()
  };
  businessAds.unshift(ad);
  saveBusinessAds();

  // Push to platform ads so it shows on app
  platformAds.unshift({
    id: ad.id,
    headline: ad.headline,
    sub: ad.sub,
    place: ad.place,
    status: 'Active',
    source: 'business',
    business: bizName,
    ends: ad.ends
  });

  if (typeof logPayment === 'function') {
    logPayment('ad', amount, 'Business ad (' + days + ' day(s)) via MMG', {
      mmg: '6124940', business: bizName, headline
    });
  } else {
    platformRevenue.ads = (platformRevenue.ads || 0) + amount;
    saveRevenue();
  }
  if (typeof logActivity === 'function') {
    logActivity('ad', 'Ad published: ' + headline + ' (GYD ' + amount + ')', { business: bizName });
  }

  closeModal();
  renderBizAds();
  if (typeof applyPlatformAds === 'function') applyPlatformAds();
  showToast('Ad published for ' + days + ' day(s)! 📢');
  return false;
}

function renderBizAds() {
  const el = document.getElementById('biz-ad-list');
  if (!el) return;
  const mine = businessAds.filter(a => {
    if (!currentUser) return true;
    return !a.business || a.business === (currentUser.businessName || 'Local Business') || true;
  });
  if (!mine.length) {
    el.innerHTML = '<p class="small">No ads yet. Create one to reach customers on The Gift Shop.</p>';
    return;
  }
  el.innerHTML = mine.map(a => `
    <div class="biz-ad-card">
      <h4>${a.headline}</h4>
      <div class="meta">${a.sub || ''} · ${a.place} · ${a.days} day(s) · GYD ${a.amount.toLocaleString()}</div>
      <span class="status-pill ${a.status === 'Active' ? 'active' : 'pending'}">${a.status}</span>
      <div class="deal-actions" style="margin-top:8px">
        <button type="button" class="btn-pause" onclick="pauseBizAd('${a.id}')">${a.status === 'Active' ? '⏸ Pause' : '▶ Resume'}</button>
      </div>
    </div>
  `).join('');
}

function pauseBizAd(id) {
  const a = businessAds.find(x => x.id === id);
  if (!a) return;
  a.status = a.status === 'Active' ? 'Paused' : 'Active';
  const p = platformAds.find(x => x.id === id);
  if (p) p.status = a.status;
  saveBusinessAds();
  renderBizAds();
  applyPlatformAds();
  showToast(a.status === 'Active' ? 'Ad live again' : 'Ad paused');
}







// ===== LIVE DELIVERY STATUS (customer) =====
const DELIVERY_STEPS = ['confirmed', 'preparing', 'accepted', 'on_the_way', 'delivered'];
const STEP_LABELS = {
  confirmed: 'Order confirmed',
  preparing: 'Business is preparing',
  accepted: 'Rider accepted your order',
  on_the_way: 'Rider is on the way',
  delivered: 'Delivered'
};

function setTrackStatusSteps(step) {
  const idx = DELIVERY_STEPS.indexOf(step);
  const steps = document.querySelectorAll('#track-status-steps .status-step');
  steps.forEach((el, i) => {
    el.classList.remove('active', 'current');
    if (i < idx) el.classList.add('active');
    else if (i === idx) el.classList.add('active', 'current');
  });
  const text = document.getElementById('track-status-text');
  if (text) text.textContent = STEP_LABELS[step] || step;
}

function createLiveOrder(payload) {
  const id = 'ORD-' + Date.now().toString(36).toUpperCase();
  const order = {
    id,
    item: payload.item || 'Your order',
    total: payload.total || 0,
    address: payload.address || '',
    phone: payload.phone || '',
    customerEmail: payload.customerEmail || (currentUser && currentUser.email) || '',
    customerName: payload.customerName || (currentUser && currentUser.name) || '',
    status: 'confirmed', // confirmed | preparing | accepted | on_the_way | delivered
    rider: null,
    createdAt: new Date().toISOString()
  };
  customerLiveOrders.unshift(order);
  saveLiveOrders();
  // Simulate business preparing after a few seconds
  setTimeout(() => {
    updateLiveOrderStatus(id, 'preparing');
  }, 4000);
  updateLiveTrackBanner();
  renderCustomerOrders();
  return order;
}

function updateLiveOrderStatus(id, status, extra) {
  const o = customerLiveOrders.find(x => x.id === id);
  if (!o) return;
  o.status = status;
  if (extra) Object.assign(o, extra);
  saveLiveOrders();
  updateLiveTrackBanner();
  renderCustomerOrders();
  // Refresh tracking modal if open for this order
  if (window.activeTrackOrderId === id && document.getElementById('tracking-modal')?.classList.contains('active')) {
    setTrackStatusSteps(status);
    if (o.rider) setTrackingRider(o.rider);
  }
}

function getActiveLiveOrder() {
  return customerLiveOrders.find(o => o.status !== 'delivered') || null;
}

function updateLiveTrackBanner() {
  const banner = document.getElementById('live-track-banner');
  const text = document.getElementById('live-track-banner-text');
  const active = getActiveLiveOrder();
  if (!banner) return;
  if (!active) {
    banner.classList.add('hidden');
    return;
  }
  banner.classList.remove('hidden');
  const msg = {
    confirmed: 'Order confirmed — waiting for kitchen…',
    preparing: 'Being prepared — waiting for a rider…',
    accepted: 'Rider accepted — tap to track live',
    on_the_way: 'Rider on the way — tap for live map'
  };
  if (text) text.textContent = msg[active.status] || 'Live delivery — tap to track';
}

function renderCustomerOrders() {
  const list = document.getElementById('orders-list');
  if (!list) return;
  if (!customerLiveOrders.length) {
    list.innerHTML = '<p class="small" style="text-align:center;padding:24px;color:var(--muted)">No orders yet. Place a delivery order to track it live here.</p>';
    return;
  }
  list.innerHTML = customerLiveOrders.map(o => {
    const pillClass = o.status === 'delivered' ? 'delivered' : (o.status === 'confirmed' || o.status === 'preparing' ? 'waiting' : '');
    const label = STEP_LABELS[o.status] || o.status;
    const canTrack = o.status !== 'delivered';
    return `
      <div class="order-live-card">
        <div class="order-status-pill ${pillClass}">${label}</div>
        <h4>${o.item}</h4>
        <div class="meta">${o.id} · GYD ${(o.total || 0).toLocaleString()}</div>
        <div class="meta">📍 ${o.address || '—'}</div>
        ${o.rider ? `<div class="meta">🛵 Rider: ${o.rider.name || 'Rider'} · ${o.rider.phone || ''}</div>` : ''}
        ${canTrack ? `<button type="button" class="primary-btn" onclick="openTrackingForOrder('${o.id}')">📍 Track live delivery</button>` : '<span class="small">Completed</span>'}
      </div>
    `;
  }).join('');
}

function openTrackingForOrder(id) {
  const o = customerLiveOrders.find(x => x.id === id);
  if (!o) return;
  window.activeTrackOrderId = id;
  window.lastDelivery = { address: o.address, phone: o.phone, orderId: id };
  openTrackingWithRider(o.address, o.phone);
  setTrackStatusSteps(o.status);
  if (o.rider) setTrackingRider(o.rider);
  // If accepted or on the way, ensure map starts
  if (['accepted', 'on_the_way'].includes(o.status)) {
    setTimeout(() => {
      if (typeof initCustomerMap === 'function') initCustomerMap();
      else if (typeof startCustomerTracking === 'function') startCustomerTracking();
    }, 300);
  }
}

function openActiveTracking() {
  const o = getActiveLiveOrder();
  if (o) openTrackingForOrder(o.id);
  else showToast('No active delivery right now');
}

// When rider accepts, advance customer live status
function notifyCustomerRiderAccepted(orderId, riderInfo) {
  // Match by any active order if ids differ in demo
  let o = orderId ? customerLiveOrders.find(x => x.id === orderId) : null;
  if (!o) o = getActiveLiveOrder();
  if (!o) return;
  o.rider = riderInfo || {
    name: (typeof Riders !== 'undefined' && Riders[0]) ? Riders[0].name : 'Marcus D.',
    phone: (typeof Riders !== 'undefined' && Riders[0]) ? Riders[0].phone : '592-671-8801',
    rating: 4.9
  };
  updateLiveOrderStatus(o.id, 'accepted', { rider: o.rider });
  setTimeout(() => updateLiveOrderStatus(o.id, 'on_the_way'), 2500);
  showToast('🛵 Rider accepted your order — track live in Orders');
}

function notifyCustomerDelivered(orderId) {
  let o = orderId ? customerLiveOrders.find(x => x.id === orderId) : getActiveLiveOrder();
  if (!o) return;
  updateLiveOrderStatus(o.id, 'delivered');
}


// Keep signup email ↔ login id in sync
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("auth-email")?.addEventListener("blur", syncEmailToIdentifier);
  document.getElementById("auth-email")?.addEventListener("change", syncEmailToIdentifier);
});
