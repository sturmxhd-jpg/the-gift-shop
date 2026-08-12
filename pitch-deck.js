const pptxgen = require("pptxgenjs");

// Design tokens – Guyana-inspired green + warm accents
const GREEN       = "1A7A4C";
const GREEN_DARK  = "0F5132";
const GREEN_SOFT  = "D1FAE5";
const ACCENT      = "F4C430";
const INK         = "111827";
const MUTE        = "6B7280";
const PAPER       = "FFFFFF";
const LIGHT_BG    = "F8FAF9";

const HEAD = "Arial";
const BODY = "Arial";

const pres = new pptxgen();
pres.layout = "LAYOUT_16x9";
pres.author = "The Gift Shop";
pres.title = "The Gift Shop – Pitch Deck";
pres.subject = "Guyana Local Deals & Delivery Platform";

// Helper: consistent footer
function footer(slide, page) {
  slide.addText("THE GIFT SHOP  ·  CONFIDENTIAL", {
    x: 0.5, y: 5.25, w: 6, h: 0.25,
    fontFace: BODY, fontSize: 10, color: MUTE, margin: 0
  });
  slide.addText(String(page), {
    x: 9.2, y: 5.25, w: 0.5, h: 0.25,
    fontFace: BODY, fontSize: 10, color: MUTE, align: "right", margin: 0
  });
}

// ============================================================
// SLIDE 1 – Title
// ============================================================
{
  const s = pres.addSlide();
  s.background = { color: GREEN_DARK };

  s.addText("🎁", {
    x: 0.5, y: 1.4, w: 9, h: 0.6,
    fontSize: 36, align: "center", margin: 0
  });

  s.addText("THE GIFT SHOP", {
    x: 0.5, y: 2.1, w: 9, h: 0.7,
    fontFace: HEAD, fontSize: 42, bold: true, color: PAPER, align: "center", margin: 0
  });

  s.addText("Guyana’s deals, delivered.", {
    x: 0.5, y: 2.8, w: 9, h: 0.4,
    fontFace: BODY, fontSize: 20, color: ACCENT, align: "center", margin: 0
  });

  s.addText("Local deals marketplace + integrated delivery platform\nfor businesses and customers across Guyana", {
    x: 1.5, y: 3.5, w: 7, h: 0.7,
    fontFace: BODY, fontSize: 14, color: "A7F3D0", align: "center", margin: 0
  });

  s.addText("Pitch Deck  ·  2026", {
    x: 0.5, y: 5.0, w: 9, h: 0.3,
    fontFace: BODY, fontSize: 12, color: "86EFAC", align: "center", margin: 0
  });
}

// ============================================================
// SLIDE 2 – The Opportunity
// ============================================================
{
  const s = pres.addSlide();
  s.background = { color: PAPER };
  footer(s, 2);

  s.addText("THE OPPORTUNITY", {
    x: 0.5, y: 0.3, w: 9, h: 0.35,
    fontFace: HEAD, fontSize: 12, bold: true, color: GREEN, charSpacing: 2, margin: 0
  });

  s.addText("Guyana is ready for a local deals platform", {
    x: 0.5, y: 0.7, w: 9, h: 0.5,
    fontFace: HEAD, fontSize: 26, bold: true, color: INK, margin: 0
  });

  const stats = [
    { num: "19%+", label: "Real GDP growth\n(one of the world’s fastest)" },
    { num: "Rising", label: "Smartphone & mobile\nmoney adoption" },
    { num: "Gap", label: "No dominant local deals\n+ delivery marketplace" }
  ];

  stats.forEach((st, i) => {
    const x = 0.5 + i * 3.1;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x, y: 1.5, w: 2.9, h: 2.2,
      fill: { color: LIGHT_BG }, rectRadius: 0.12
    });
    s.addText(st.num, {
      x, y: 1.75, w: 2.9, h: 0.7,
      fontFace: HEAD, fontSize: 28, bold: true, color: GREEN, align: "center", margin: 0
    });
    s.addText(st.label, {
      x: x + 0.15, y: 2.55, w: 2.6, h: 0.9,
      fontFace: BODY, fontSize: 13, color: MUTE, align: "center", margin: 0
    });
  });

  s.addText("Small businesses still rely on WhatsApp and walk-ins. Customers want easy savings and delivery. The Gift Shop connects both.", {
    x: 0.5, y: 4.0, w: 9, h: 0.7,
    fontFace: BODY, fontSize: 14, color: INK, margin: 0
  });
}

// ============================================================
// SLIDE 3 – Solution
// ============================================================
{
  const s = pres.addSlide();
  s.background = { color: PAPER };
  footer(s, 3);

  s.addText("THE SOLUTION", {
    x: 0.5, y: 0.3, w: 9, h: 0.3,
    fontFace: HEAD, fontSize: 12, bold: true, color: GREEN, charSpacing: 2, margin: 0
  });

  s.addText("One app. Three sides of the marketplace.", {
    x: 0.5, y: 0.65, w: 9, h: 0.45,
    fontFace: HEAD, fontSize: 24, bold: true, color: INK, margin: 0
  });

  const roles = [
    { icon: "👤", title: "Customers", desc: "Discover exclusive deals, redeem in-store or get delivery. Free to use." },
    { icon: "🏪", title: "Businesses", desc: "Pay a monthly subscription to post deals, receive orders, and reach new customers." },
    { icon: "🛵", title: "Delivery Partners", desc: "Accept delivery jobs from businesses in real time and earn on every completed order." }
  ];

  roles.forEach((r, i) => {
    const y = 1.35 + i * 1.15;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: 0.5, y, w: 9, h: 1.05,
      fill: { color: LIGHT_BG }, rectRadius: 0.1
    });
    s.addText(r.icon, {
      x: 0.7, y: y + 0.25, w: 0.7, h: 0.55,
      fontSize: 26, margin: 0
    });
    s.addText(r.title, {
      x: 1.5, y: y + 0.18, w: 7.5, h: 0.35,
      fontFace: HEAD, fontSize: 16, bold: true, color: INK, margin: 0
    });
    s.addText(r.desc, {
      x: 1.5, y: y + 0.52, w: 7.5, h: 0.4,
      fontFace: BODY, fontSize: 13, color: MUTE, margin: 0
    });
  });
}

// ============================================================
// SLIDE 4 – Product / Prototype
// ============================================================
{
  const s = pres.addSlide();
  s.background = { color: PAPER };
  footer(s, 4);

  s.addText("PRODUCT", {
    x: 0.5, y: 0.3, w: 9, h: 0.3,
    fontFace: HEAD, fontSize: 12, bold: true, color: GREEN, charSpacing: 2, margin: 0
  });

  s.addText("Interactive prototype is live", {
    x: 0.5, y: 0.65, w: 9, h: 0.4,
    fontFace: HEAD, fontSize: 24, bold: true, color: INK, margin: 0
  });

  s.addText("A clickable web prototype demonstrates the full customer, business and rider experience with real sample data for Georgetown.", {
    x: 0.5, y: 1.15, w: 9, h: 0.5,
    fontFace: BODY, fontSize: 14, color: MUTE, margin: 0
  });

  const feats = [
    { t: "Customer App", d: "Browse deals, filter by category, cart, pickup or delivery checkout, free-delivery threshold" },
    { t: "Business Portal", d: "Dashboard, deal management, incoming orders, weekly settlement with visual breakdown" },
    { t: "Rider App", d: "Online toggle, available jobs, accept/decline, active delivery, earnings tracking" },
    { t: "Settlement Engine", d: "Transparent weekly statements showing commission, free-delivery subsidy, fees & net payout" }
  ];

  feats.forEach((f, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 0.5 + col * 4.7;
    const y = 1.85 + row * 1.4;

    s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x, y, w: 4.4, h: 1.25,
      fill: { color: LIGHT_BG }, rectRadius: 0.1
    });
    s.addShape(pres.shapes.RECTANGLE, {
      x, y, w: 0.1, h: 1.25,
      fill: { color: GREEN }
    });
    s.addText(f.t, {
      x: x + 0.3, y: y + 0.2, w: 3.9, h: 0.35,
      fontFace: HEAD, fontSize: 15, bold: true, color: INK, margin: 0
    });
    s.addText(f.d, {
      x: x + 0.3, y: y + 0.55, w: 3.9, h: 0.55,
      fontFace: BODY, fontSize: 12, color: MUTE, margin: 0
    });
  });
}

// ============================================================
// SLIDE 5 – Business Model
// ============================================================
{
  const s = pres.addSlide();
  s.background = { color: PAPER };
  footer(s, 5);

  s.addText("BUSINESS MODEL", {
    x: 0.5, y: 0.3, w: 9, h: 0.3,
    fontFace: HEAD, fontSize: 12, bold: true, color: GREEN, charSpacing: 2, margin: 0
  });

  s.addText("Subscriptions + take rate on value created", {
    x: 0.5, y: 0.65, w: 9, h: 0.4,
    fontFace: HEAD, fontSize: 22, bold: true, color: INK, margin: 0
  });

  const tiers = [
    [
      { text: "", options: { fill: { color: GREEN }, color: "FFFFFF", bold: true } },
      { text: "Starter", options: { fill: { color: GREEN }, color: "FFFFFF", bold: true } },
      { text: "Growth", options: { fill: { color: GREEN }, color: "FFFFFF", bold: true } },
      { text: "Premium", options: { fill: { color: GREEN }, color: "FFFFFF", bold: true } }
    ],
    ["Monthly fee", "GYD 4,500", "GYD 9,500", "GYD 18,000"],
    ["Active deals", "Up to 5", "Unlimited", "Unlimited"],
    ["Delivery integration", "—", "Yes", "Yes + priority"],
    ["Commission (in-store)", "8%", "5%", "3.5%"],
    ["Commission (delivery)", "10%", "7%", "5%"],
    ["Best for", "Testing / micro", "Most businesses", "Multi-location"]
  ];

  s.addTable(tiers, {
    x: 0.5, y: 1.25, w: 9, h: 3.5,
    colW: [2.4, 2.2, 2.2, 2.2],
    border: { pt: 0.5, color: "E5E7EB" },
    fontFace: BODY,
    fontSize: 13,
    color: INK,
    align: "center",
    valign: "middle"
  });
}

// ============================================================
// SLIDE 6 – Unit Economics Snapshot
// ============================================================
{
  const s = pres.addSlide();
  s.background = { color: PAPER };
  footer(s, 6);

  s.addText("UNIT ECONOMICS (EXAMPLE)", {
    x: 0.5, y: 0.3, w: 9, h: 0.3,
    fontFace: HEAD, fontSize: 12, bold: true, color: GREEN, charSpacing: 2, margin: 0
  });

  s.addText("Growth plan restaurant – one week", {
    x: 0.5, y: 0.65, w: 9, h: 0.4,
    fontFace: HEAD, fontSize: 22, bold: true, color: INK, margin: 0
  });

  const nums = [
    { label: "Gross Sales", value: "GYD 142,900" },
    { label: "Platform Commission", value: "GYD 8,947" },
    { label: "Free Delivery Cost", value: "GYD 6,050" },
    { label: "Net to Business", value: "GYD 114,626" }
  ];

  nums.forEach((n, i) => {
    const x = 0.5 + i * 2.35;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x, y: 1.3, w: 2.2, h: 1.5,
      fill: { color: i === 3 ? GREEN_SOFT : LIGHT_BG }, rectRadius: 0.1
    });
    s.addText(n.value, {
      x, y: 1.55, w: 2.2, h: 0.55,
      fontFace: HEAD, fontSize: 15, bold: true, color: i === 3 ? GREEN_DARK : INK, align: "center", margin: 0
    });
    s.addText(n.label, {
      x: x + 0.1, y: 2.2, w: 2.0, h: 0.4,
      fontFace: BODY, fontSize: 12, color: MUTE, align: "center", margin: 0
    });
  });

  s.addText("Delivery fee (customer-paid) is split ~72% rider / ~23% platform. Businesses only absorb free-delivery promotions they choose to run.", {
    x: 0.5, y: 3.1, w: 9, h: 0.55,
    fontFace: BODY, fontSize: 13, color: MUTE, margin: 0
  });

  s.addText("Target blended platform take rate: 8–12% of GMV once marketplace density is achieved.", {
    x: 0.5, y: 3.7, w: 9, h: 0.4,
    fontFace: BODY, fontSize: 14, bold: true, color: INK, margin: 0
  });
}

// ============================================================
// SLIDE 7 – Go-to-Market
// ============================================================
{
  const s = pres.addSlide();
  s.background = { color: PAPER };
  footer(s, 7);

  s.addText("GO-TO-MARKET", {
    x: 0.5, y: 0.3, w: 9, h: 0.3,
    fontFace: HEAD, fontSize: 12, bold: true, color: GREEN, charSpacing: 2, margin: 0
  });

  s.addText("Start focused, expand regionally", {
    x: 0.5, y: 0.65, w: 9, h: 0.4,
    fontFace: HEAD, fontSize: 22, bold: true, color: INK, margin: 0
  });

  const steps = [
    { num: "01", title: "Greater Georgetown", desc: "Onboard 80–120 quality businesses (restaurants, gift shops, fashion, beauty). Recruit 30–50 reliable riders." },
    { num: "02", title: "Density & Trust", desc: "Drive redemptions and reviews. Offer early free months + low commission to build inventory and habit." },
    { num: "03", title: "East Bank & Beyond", desc: "Expand to East Bank Demerara, then Linden and other population centres once unit economics are proven." },
    { num: "04", title: "Brand Moments", desc: "Partner with festivals, Mash, Christmas Village and tourism operators for high-visibility campaigns." }
  ];

  steps.forEach((st, i) => {
    const y = 1.25 + i * 0.9;
    s.addText(st.num, {
      x: 0.5, y, w: 0.8, h: 0.4,
      fontFace: HEAD, fontSize: 18, bold: true, color: GREEN, margin: 0
    });
    s.addText(st.title, {
      x: 1.4, y, w: 7.5, h: 0.35,
      fontFace: HEAD, fontSize: 15, bold: true, color: INK, margin: 0
    });
    s.addText(st.desc, {
      x: 1.4, y: y + 0.35, w: 7.8, h: 0.4,
      fontFace: BODY, fontSize: 13, color: MUTE, margin: 0
    });
  });
}

// ============================================================
// SLIDE 8 – Why Now
// ============================================================
{
  const s = pres.addSlide();
  s.background = { color: PAPER };
  footer(s, 8);

  s.addText("WHY NOW", {
    x: 0.5, y: 0.3, w: 9, h: 0.3,
    fontFace: HEAD, fontSize: 12, bold: true, color: GREEN, charSpacing: 2, margin: 0
  });

  s.addText("The window is open", {
    x: 0.5, y: 0.65, w: 9, h: 0.4,
    fontFace: HEAD, fontSize: 22, bold: true, color: INK, margin: 0
  });

  const reasons = [
    "Oil-driven growth is expanding the middle class and consumer spending",
    "Smartphone penetration and mobile money are rising rapidly",
    "No single platform yet owns local deals + last-mile delivery in Guyana",
    "Small businesses need digital channels without building their own apps"
  ];

  reasons.forEach((r, i) => {
    const y = 1.25 + i * 0.55;
    s.addShape(pres.shapes.OVAL, {
      x: 0.55, y: y + 0.08, w: 0.22, h: 0.22,
      fill: { color: GREEN }
    });
    s.addText(r, {
      x: 1.0, y, w: 8.3, h: 0.45,
      fontFace: BODY, fontSize: 15, color: INK, margin: 0
    });
  });

  s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: 0.5, y: 3.6, w: 9, h: 1.2,
    fill: { color: GREEN_DARK }, rectRadius: 0.1
  });

  s.addText("NEXT STEP", {
    x: 0.7, y: 3.75, w: 8.6, h: 0.3,
    fontFace: HEAD, fontSize: 12, bold: true, color: ACCENT, margin: 0
  });

  s.addText("Pilot with 20–30 Georgetown businesses and a small rider fleet.\nValidate conversion, retention and unit economics before full launch.", {
    x: 0.7, y: 4.1, w: 8.6, h: 0.55,
    fontFace: BODY, fontSize: 14, color: PAPER, margin: 0
  });
}

// ============================================================
// SLIDE 9 – Closing
// ============================================================
{
  const s = pres.addSlide();
  s.background = { color: GREEN_DARK };

  s.addText("🎁", {
    x: 0.5, y: 1.5, w: 9, h: 0.6,
    fontSize: 40, align: "center", margin: 0
  });

  s.addText("THE GIFT SHOP", {
    x: 0.5, y: 2.2, w: 9, h: 0.55,
    fontFace: HEAD, fontSize: 32, bold: true, color: PAPER, align: "center", margin: 0
  });

  s.addText("Guyana’s deals, delivered.", {
    x: 0.5, y: 2.8, w: 9, h: 0.4,
    fontFace: BODY, fontSize: 18, color: ACCENT, align: "center", margin: 0
  });

  s.addText("Prototype available  ·  Ready to pilot", {
    x: 0.5, y: 3.6, w: 9, h: 0.35,
    fontFace: BODY, fontSize: 14, color: "A7F3D0", align: "center", margin: 0
  });

  s.addText("support@thegiftshop.gy", {
    x: 0.5, y: 4.5, w: 9, h: 0.3,
    fontFace: BODY, fontSize: 13, color: "86EFAC", align: "center", margin: 0
  });
}

pres.writeFile({ fileName: "/home/workdir/artifacts/the-gift-shop/The_Gift_Shop_Pitch_Deck.pptx" })
  .then(() => console.log("Pitch deck written successfully"))
  .catch(err => console.error(err));
