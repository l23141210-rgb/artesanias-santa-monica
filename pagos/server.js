const express = require("express");
const Stripe = require("stripe");
const PDFDocument = require("pdfkit");
const fs = require("fs"), path = require("path"), crypto = require("crypto");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const BASE_URL = process.env.BASE_URL || "http://localhost:8080";
const ADMIN_KEY = process.env.ADMIN_KEY;
const FILE = process.env.DATA_FILE || "/data/ordenes.json";

const load = () => { try { return JSON.parse(fs.readFileSync(FILE)); } catch { return {}; } };
const save = (d) => { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(d, null, 1)); };

// Compara la clave de administrador sin filtrar información por tiempos de respuesta
const esAdmin = (req) => {
  const k = String(req.headers["x-admin-key"] || "");
  return !!ADMIN_KEY && k.length === ADMIN_KEY.length &&
    crypto.timingSafeEqual(Buffer.from(k), Buffer.from(ADMIN_KEY));
};

const app = express();

// 1) Webhook de Stripe (debe ir ANTES de express.json: necesita el cuerpo sin procesar)
app.post("/api/pagos/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  let ev;
  try {
    ev = stripe.webhooks.constructEvent(req.body, req.headers["stripe-signature"], process.env.STRIPE_WEBHOOK_SECRET);
  } catch { return res.status(400).send("Firma inválida"); }

  const s = ev.data.object;
  const pagado =
    (ev.type === "checkout.session.completed" && s.payment_status === "paid") ||
    ev.type === "checkout.session.async_payment_succeeded";

  if (pagado && s.metadata && s.metadata.orden) {
    const d = load(), o = d[s.metadata.orden];
    if (o && o.estado !== "pagada") {
      o.estado = "pagada";
      o.pagadoEn = new Date().toISOString();
      try {
        const pi = await stripe.paymentIntents.retrieve(s.payment_intent, { expand: ["latest_charge"] });
        o.metodo = pi.latest_charge.payment_method_details.type; // "card" u "oxxo"
      } catch {}
      save(d);
    }
  }
  res.json({ received: true });
});

app.use(express.json());

// 2) Crear pedido (solo tú, con la clave de administrador)
app.post("/api/pagos/ordenes", (req, res) => {
  if (!esAdmin(req)) return res.status(401).json({ error: "No autorizado" });
  const { concepto, monto, cliente } = req.body;
  if (!concepto || !(monto >= 10)) return res.status(400).json({ error: "Datos inválidos" });
  const id = "ORD-" + crypto.randomBytes(6).toString("hex").toUpperCase();
  const d = load();
  d[id] = { id, concepto: String(concepto).slice(0, 120), monto: Math.round(monto * 100) / 100,
            cliente: String(cliente || "").slice(0, 80), estado: "pendiente", creada: new Date().toISOString() };
  save(d);
  res.json({ id, link: `${BASE_URL}/pagar.html?orden=${id}` });
});

// 3) Consultar un pedido (lo usa pagar.html)
app.get("/api/pagos/ordenes/:id", (req, res) => {
  const o = load()[req.params.id];
  if (!o) return res.status(404).json({ error: "No existe" });
  res.json({ id: o.id, concepto: o.concepto, monto: o.monto, estado: o.estado });
});

// 4) Crear la sesión de pago (el monto sale del servidor, nunca del navegador)
app.post("/api/pagos/checkout", async (req, res) => {
  const o = load()[req.body.orden];
  if (!o || o.estado === "pagada") return res.status(400).json({ error: "Pedido no válido" });
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card", "oxxo"],
      payment_method_options: { oxxo: { expires_after_days: 3 } },
      line_items: [{ quantity: 1, price_data: { currency: "mxn", unit_amount: Math.round(o.monto * 100), product_data: { name: o.concepto } } }],
      metadata: { orden: o.id },
      success_url: `${BASE_URL}/pagar.html?orden=${o.id}&ok=1`,
      cancel_url: `${BASE_URL}/pagar.html?orden=${o.id}`
    });
    res.json({ url: session.url });
  } catch (e) { console.error(e.message); res.status(500).json({ error: "No se pudo iniciar el pago" }); }
});

// 5) Comprobante en PDF (solo si ya está pagado)
app.get("/api/pagos/comprobante/:id", (req, res) => {
  const o = load()[req.params.id];
  if (!o || o.estado !== "pagada") return res.status(404).send("Comprobante no disponible");
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="comprobante-${o.id}.pdf"`);
  const pdf = new PDFDocument({ margin: 50 });
  pdf.pipe(res);
  pdf.fontSize(20).text("Artesanías de Mármol Santa Mónica");
  pdf.fontSize(10).fillColor("#666").text("Vizarrón de Montes, Cadereyta de Montes, Querétaro");
  pdf.moveDown(2).fillColor("#000").fontSize(16).text("Comprobante de pago").moveDown().fontSize(11);
  const filas = [
    ["Folio", o.id],
    ["Fecha de pago", new Date(o.pagadoEn).toLocaleString("es-MX", { timeZone: "America/Mexico_City" })],
    ["Cliente", o.cliente || "-"],
    ["Concepto", o.concepto],
    ["Método de pago", o.metodo === "oxxo" ? "Efectivo en OXXO" : "Tarjeta"],
    ["Total pagado", `$${o.monto.toLocaleString("es-MX", { minimumFractionDigits: 2 })} MXN`]
  ];
  filas.forEach(([k, v]) => { pdf.font("Helvetica-Bold").text(k + ": ", { continued: true }).font("Helvetica").text(String(v)); });
    if (o.lineas) {
    pdf.moveDown().font("Helvetica-Bold").text("Detalle:");
    o.lineas.forEach((l) => pdf.font("Helvetica").text(
      `${l.cantidad} x ${l.nombre} (${l.id}) - $${(l.precio * l.cantidad).toLocaleString("es-MX", { minimumFractionDigits: 2 })} MXN`));
  }
  pdf.moveDown(2).fontSize(9).fillColor("#666")
     .text("Este documento es un comprobante de pago y no sustituye una factura fiscal (CFDI).");
  pdf.end();
});
// ===== Carrito =====
const CATALOGO = process.env.CATALOGO_FILE || "/app/catalogo.js";
const leerCatalogo = () => {
  const txt = fs.readFileSync(CATALOGO, "utf8");
  return JSON.parse(txt.slice(txt.indexOf("["), txt.lastIndexOf("]") + 1));
};

app.post("/api/pagos/carrito", async (req, res) => {
  const pedido = Array.isArray(req.body.items) ? req.body.items.slice(0, 30) : [];
  let catalogo;
  try { catalogo = leerCatalogo(); } catch { return res.status(500).json({ error: "Catálogo no disponible" }); }

  const lineas = [];
  for (const it of pedido) {
    const t = catalogo.find((x) => x.id === it.id);
    const cant = Math.floor(Number(it.cantidad));
    if (!t || typeof t.precio !== "number" || !(cant >= 1 && cant <= 20))
      return res.status(400).json({ error: "Artículo no válido en el carrito" });
    lineas.push({ id: t.id, nombre: t.nombre, precio: t.precio, cantidad: cant });
  }
  if (!lineas.length) return res.status(400).json({ error: "El carrito está vacío" });

  const monto = lineas.reduce((s, l) => s + l.precio * l.cantidad, 0);
  const id = "ORD-" + crypto.randomBytes(6).toString("hex").toUpperCase();
  const d = load();
  d[id] = { id, concepto: `Pedido de ${lineas.length} diseño(s)`, lineas, monto,
            cliente: String(req.body.cliente || "").slice(0, 80), estado: "pendiente", creada: new Date().toISOString() };
  save(d);

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card", "oxxo"],
      payment_method_options: { oxxo: { expires_after_days: 3 } },
      line_items: lineas.map((l) => ({
        quantity: l.cantidad,
        price_data: { currency: "mxn", unit_amount: Math.round(l.precio * 100), product_data: { name: `${l.nombre} (${l.id})` } }
      })),
      metadata: { orden: id },
      success_url: `${BASE_URL}/pagar.html?orden=${id}&ok=1`,
      cancel_url: `${BASE_URL}/#catalogo`
    });
    res.json({ url: session.url });
  } catch (e) { console.error(e.message); res.status(500).json({ error: "No se pudo iniciar el pago" }); }
});
// ===== Panel de administrador =====
app.get("/api/pagos/admin/ordenes", (req, res) => {
  if (!esAdmin(req)) return res.status(401).json({ error: "No autorizado" });
  const lista = Object.values(load()).sort((a, b) => (b.creada || "").localeCompare(a.creada || ""));
  res.json(lista);
});

app.delete("/api/pagos/admin/ordenes/:id", (req, res) => {
  if (!esAdmin(req)) return res.status(401).json({ error: "No autorizado" });
  const d = load(), o = d[req.params.id];
  if (!o) return res.status(404).json({ error: "No existe" });
  if (o.estado === "pagada") return res.status(400).json({ error: "No se puede borrar un pedido pagado" });
  delete d[req.params.id];
  save(d);
  res.json({ ok: true });
});
app.listen(4000, () => console.log("Pagos en :4000"));