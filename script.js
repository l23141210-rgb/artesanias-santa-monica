
"use strict";
const WHATSAPP_NUMBER = "524412656744";

// DATOS DEL NEGOCIO (cámbialos por los reales)
const NEGOCIO = {
  direccion: "Vizarrón de Montes, Cadereyta de Montes, Querétaro",
  horario: "Lunes a sábado, 9:00 a 18:00"
};

// PRECIOS DE EJEMPLO: cámbialos por los reales.
// Para dar precio a una pieza en particular, agrega  precio: "Desde $2,000 MXN"  a esa pieza.
const PRECIO_DESDE = {
  "Lápidas": "Desde $3,500 MXN",
  "Escaleras": "Desde $1,800 MXN",
  "Comedores": "Desde $9,500 MXN",
  "Altares": "Desde $4,000 MXN",
  "Mesas": "Desde $3,000 MXN",
  "Floreros": "Desde $800 MXN",
  "Lavabos": "Desde $2,200 MXN"
};

// Diseños de demostración.
// Sustituiremos estas imágenes por las fotografías reales.



const gallery = document.getElementById("gallery");
const categories = document.getElementById("categories");
const workCount = document.getElementById("workCount");
const emptyMessage = document.getElementById("emptyMessage");

let categoriaActual = "Todos";

// ---------- Cuenta (demo en el navegador) y favoritos ----------
const leer = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const guardar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
let usuario = leer("sm_session", null);
const favKey = () => "sm_favs_" + usuario.email;
const favoritos = () => (usuario ? leer(favKey(), []) : []);

let listaVisible = [];
const norm = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const searchInput = document.getElementById("searchInput");
searchInput.addEventListener("input", () => {
  mostrarTrabajos();
});

function revelar(els) {
  if (!("IntersectionObserver" in window)) return;
  const io = new IntersectionObserver((es) => es.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add("visible"); io.unobserve(e.target); }
  }), { threshold: 0.12 });
  els.forEach((el) => { el.classList.add("reveal"); io.observe(el); });
}

function precioDe(t) {
  if (typeof t.precio === "number") return t.precio.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
  return t.precio || PRECIO_DESDE[t.categoria] || "Cotizar";
}

function abrirWA(mensaje) {
  if (!/^\d{10,15}$/.test(WHATSAPP_NUMBER)) { alert("Configura primero el número de WhatsApp en script.js."); return; }
  window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(mensaje)}`, "_blank", "noopener,noreferrer");
}

// Crear las tarjetas de imágenes
function mostrarTrabajos() {
  const favs = favoritos();
  const q = norm(searchInput.value);
  const filtrados = trabajos.filter((t) =>
    (categoriaActual === "Todos" ||
      (categoriaActual === "Favoritos" ? favs.includes(t.id) : t.categoria === categoriaActual)) &&
    (!q || norm(`${t.id} ${t.nombre} ${t.categoria}`).includes(q)));

  listaVisible = filtrados;
  gallery.innerHTML = "";

  filtrados.forEach((t) => {
    const card = document.createElement("article");
    card.className = "gallery-card";
    const esFav = favs.includes(t.id);
    card.innerHTML = `
      <div class="gallery-image-wrap"><img class="gallery-image" loading="lazy"></div>
      <div class="gallery-caption">
        <span class="id-badge"></span><h3></h3><span class="cat"></span>
        <p class="price"></p>
        <div class="card-actions">
          <button type="button" class="add-btn" ${typeof t.precio === "number" ? "" : "hidden"}>AGREGAR 🛒</button>
          <button type="button" class="quote-btn">COTIZAR ↗</button>
        <button type="button" class="fav-btn${esFav ? " on" : ""}" aria-label="Guardar en favoritos" ${usuario ? "" : "hidden"}>${esFav ? "♥" : "♡"}</button>
        </div>
      </div>`;
    const img = card.querySelector("img");
    img.onload = img.onerror = () => img.classList.add("loaded");
    img.src = t.imagen;
    img.alt = `${t.nombre} - imagen ilustrativa`;
    card.querySelector(".id-badge").textContent = "ID: " + t.id;
    card.querySelector("h3").textContent = t.nombre;
    card.querySelector(".cat").textContent = t.categoria;
    card.querySelector(".price").textContent = precioDe(t);
    img.addEventListener("click", () => abrirLightbox(t));
        card.querySelector(".add-btn").addEventListener("click", () => agregarAlCarrito(t));
    card.querySelector(".quote-btn").addEventListener("click", () => {
      const quien = usuario ? `Hola, soy ${usuario.nombre}. ` : "Hola, ";
      abrirWA(`${quien}me interesa el diseño ${t.id}: "${t.nombre}" (${t.categoria}). ¿Me pueden dar información y una cotización?`);
    });
    card.querySelector(".fav-btn").addEventListener("click", () => {
      const lista = favoritos();
      const i = lista.indexOf(t.id);
      i >= 0 ? lista.splice(i, 1) : lista.push(t.id);
      guardar(favKey(), lista);
      toast(i >= 0 ? "Quitado de favoritos" : "Guardado en favoritos ♥");
      mostrarTrabajos();
    });
    gallery.appendChild(card);
  });
  revelar(gallery.querySelectorAll(".gallery-card"));

  workCount.textContent =
    `${filtrados.length} ${filtrados.length === 1 ? "trabajo" : "trabajos"}`;

  emptyMessage.textContent = q ? `No encontramos diseños para "${searchInput.value}".` : categoriaActual === "Favoritos"
    ? "Aún no tienes favoritos. Toca ♡ en las piezas que te gusten."
    : "Todavía no hay fotografías en esta categoría.";
  emptyMessage.hidden = filtrados.length > 0;
  gallery.hidden = filtrados.length === 0;
}

// Ocultar categorías sin fotografías
categories.querySelectorAll(".category").forEach((b) => {
  const c = b.dataset.category;
  if (c !== "Todos" && c !== "Favoritos" && !trabajos.some((t) => t.categoria === c)) b.hidden = true;
});

// Visor de diseños (lightbox) con navegación y enlace por ID
const lightbox = document.getElementById("lightbox");
const lightboxImg = document.getElementById("lightboxImg");
let lbIdx = 0;

function pintarLB() {
  const t = listaVisible[lbIdx];
  lightboxImg.src = t.imagen;
  lightboxImg.alt = t.nombre;
  document.getElementById("lbId").textContent = "ID: " + t.id;
  document.getElementById("lbNombre").textContent = t.nombre;
  document.getElementById("lbPrecio").textContent = precioDe(t);
  history.replaceState(null, "", "#" + t.id);
}
function abrirLightbox(t) {
  let i = listaVisible.findIndex((x) => x.id === t.id);
  if (i < 0) { listaVisible = trabajos; i = trabajos.findIndex((x) => x.id === t.id); }
  lbIdx = i; pintarLB(); lightbox.hidden = false;
}
function moverLB(d) { lbIdx = (lbIdx + d + listaVisible.length) % listaVisible.length; pintarLB(); }
function cerrarLB() {
  if (lightbox.hidden) return;
  lightbox.hidden = true;
  history.replaceState(null, "", location.pathname + location.search);
}
lightbox.addEventListener("click", (e) => { if (e.target === lightbox) cerrarLB(); });
document.getElementById("lightboxClose").addEventListener("click", cerrarLB);
document.getElementById("lbPrev").addEventListener("click", () => moverLB(-1));
document.getElementById("lbNext").addEventListener("click", () => moverLB(1));
document.getElementById("lbCotizar").addEventListener("click", () => {
  const t = listaVisible[lbIdx];
  abrirWA(`${usuario ? `Hola, soy ${usuario.nombre}. ` : "Hola, "}me interesa el diseño ${t.id}: "${t.nombre}" (${t.categoria}). ¿Me pueden dar información y una cotización?`);
});
document.getElementById("lbShare").addEventListener("click", async () => {
  const url = location.origin + location.pathname + "#" + listaVisible[lbIdx].id;
  try { await navigator.clipboard.writeText(url); toast("Enlace copiado"); } catch { prompt("Copia este enlace:", url); }
});
function abrirDesdeHash() {
  const t = trabajos.find((x) => "#" + x.id === location.hash.toUpperCase());
  if (t) abrirLightbox(t);
}
window.addEventListener("hashchange", abrirDesdeHash);

// Aviso rápido (toast)
function toast(msg) {
  const el = document.createElement("div");
  el.className = "toast"; el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.classList.add("out"), 2200);
  setTimeout(() => el.remove(), 2700);
}

// Aviso de privacidad
const privModal = document.getElementById("privModal");
document.querySelectorAll(".priv-open").forEach((a) => a.addEventListener("click", (e) => { e.preventDefault(); privModal.hidden = false; }));
document.getElementById("privClose").addEventListener("click", () => { privModal.hidden = true; });
privModal.addEventListener("click", (e) => { if (e.target === privModal) privModal.hidden = true; });

// Encabezado con sombra, menú activo y botón "volver arriba"
const headerEl = document.querySelector(".header");
const toTop = document.getElementById("toTop");
window.addEventListener("scroll", () => {
  headerEl.classList.toggle("scrolled", scrollY > 30);
  toTop.hidden = scrollY < 600;
}, { passive: true });
toTop.addEventListener("click", () => scrollTo({ top: 0, behavior: "smooth" }));
if ("IntersectionObserver" in window) {
  const spy = new IntersectionObserver((es) => es.forEach((e) => {
    if (e.isIntersecting) document.querySelectorAll(".nav a").forEach((l) => l.classList.toggle("active", l.getAttribute("href") === "#" + e.target.id));
  }), { rootMargin: "-45% 0px -50% 0px" });
  ["nosotros", "catalogo", "proceso", "contacto"].forEach((id) => { const s = document.getElementById(id); if (s) spy.observe(s); });
}

// Datos del negocio en la sección de contacto
document.getElementById("dirTexto").textContent = NEGOCIO.direccion;
document.getElementById("horarioTexto").textContent = NEGOCIO.horario;
document.getElementById("telTexto").textContent = `+${WHATSAPP_NUMBER.slice(0, 2)} ${WHATSAPP_NUMBER.slice(2, 5)} ${WHATSAPP_NUMBER.slice(5, 8)} ${WHATSAPP_NUMBER.slice(8)}`;
document.getElementById("mapaLink").href =
  "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(NEGOCIO.direccion);

document.getElementById("mapaEmbed").src =
  "https://maps.google.com/maps?output=embed&q=" + encodeURIComponent(NEGOCIO.direccion);
document.getElementById("waFloat").addEventListener("click", (e) => {
  e.preventDefault();
  abrirWA(`${usuario ? `Hola, soy ${usuario.nombre}. ` : "Hola, "}me gustaría información y una cotización.`);
});
revelar(document.querySelectorAll(".presentation, .about, .process-step, .faq, .contact"));

// Registro e inicio de sesión (con servidor si existe /api; si no, demo local)
// OJO: es una demo sin servidor. Los datos se guardan solo en este navegador.
const accountBtn = document.getElementById("accountBtn");
const authModal = document.getElementById("authModal");
const authError = document.getElementById("authError");
const favTab = document.getElementById("favTab");

async function hash(t) {
  if (window.crypto && crypto.subtle) {
    const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t));
    return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
  }
  return btoa(unescape(encodeURIComponent(t)));
}

function pintarSesion() {
  accountBtn.textContent = usuario ? `Hola, ${usuario.nombre.split(" ")[0]} · Salir` : "Iniciar sesión";
  favTab.hidden = !usuario;
  if (!usuario && categoriaActual === "Favoritos") {
    categoriaActual = "Todos";
    categories.querySelectorAll(".category").forEach((i) => i.classList.toggle("active", i.dataset.category === "Todos"));
  }
  mostrarTrabajos();
}

function abrirAuth(tab) {
  document.querySelectorAll(".auth-tab").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  document.getElementById("loginForm").hidden = tab !== "login";
  document.getElementById("registroForm").hidden = tab !== "registro";
  authError.textContent = "";
  authModal.hidden = false;
}

accountBtn.addEventListener("click", () => {
  if (usuario) { usuario = null; guardar("sm_session", null); pintarSesion(); toast("Sesión cerrada"); }
  else abrirAuth("login");
});
document.getElementById("authClose").addEventListener("click", () => { authModal.hidden = true; });
authModal.addEventListener("click", (e) => { if (e.target === authModal) authModal.hidden = true; });
document.querySelectorAll(".auth-tab").forEach((b) => b.addEventListener("click", () => abrirAuth(b.dataset.tab)));
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") { authModal.hidden = true; privModal.hidden = true; cerrarLB(); }
  if (!lightbox.hidden && e.key === "ArrowLeft") moverLB(-1);
  if (!lightbox.hidden && e.key === "ArrowRight") moverLB(1);
});

async function api(ruta, datos) {
  try {
    const r = await fetch("/api/" + ruta, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(datos) });
    if (r.status === 404 || r.status === 405 || r.status >= 500) return null;
    return { ok: r.ok, ...(await r.json()) };
  } catch { return null; }
}

function iniciar(u) {
  usuario = { nombre: u.nombre, email: u.email };
  guardar("sm_session", usuario);
  authModal.hidden = true;
  pintarSesion();
  toast(`Bienvenido, ${usuario.nombre.split(" ")[0]}`);
}

document.getElementById("registroForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  const email = f.get("email").trim().toLowerCase();
  const srv = await api("registro", { nombre: f.get("nombre"), email, telefono: f.get("telefono"), password: f.get("password") });
  if (srv) {
    if (!srv.ok) { authError.textContent = srv.error; return; }
    e.target.reset(); return iniciar({ nombre: srv.nombre, email });
  }
  const users = leer("sm_users", {});
  if (users[email]) { authError.textContent = "Ese correo ya está registrado. Inicia sesión."; return; }
  users[email] = { nombre: f.get("nombre").trim(), telefono: f.get("telefono").trim(), pass: await hash(f.get("password")) };
  guardar("sm_users", users);
  e.target.reset();
  iniciar({ nombre: users[email].nombre, email });
});

document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  const email = f.get("email").trim().toLowerCase();
  const srv = await api("login", { email, password: f.get("password") });
  if (srv) {
    if (!srv.ok) { authError.textContent = srv.error; return; }
    e.target.reset(); return iniciar({ nombre: srv.nombre, email });
  }
  const u = leer("sm_users", {})[email];
  if (!u || u.pass !== await hash(f.get("password"))) { authError.textContent = "Correo o contraseña incorrectos."; return; }
  e.target.reset();
  iniciar({ nombre: u.nombre, email });
});

// Filtrar por categoría
categories.addEventListener("click", (event) => {
  const boton = event.target.closest("[data-category]");

  if (!boton) return;

  categoriaActual = boton.dataset.category;

  categories.querySelectorAll(".category").forEach((item) => {
    const seleccionado = item === boton;

    item.classList.toggle("active", seleccionado);
    item.setAttribute("aria-pressed", String(seleccionado));
  });

  mostrarTrabajos();
});

// Menú para móviles
const menuToggle = document.getElementById("menuToggle");
const nav = document.getElementById("nav");

menuToggle.addEventListener("click", () => {
  const abierto = nav.classList.toggle("open");

  menuToggle.setAttribute("aria-expanded", String(abierto));
  menuToggle.setAttribute(
    "aria-label",
    abierto ? "Cerrar menú" : "Abrir menú"
  );
  menuToggle.textContent = abierto ? "×" : "☰";
});

nav.querySelectorAll("a").forEach((enlace) => {
  enlace.addEventListener("click", () => {
    nav.classList.remove("open");
    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.setAttribute("aria-label", "Abrir menú");
    menuToggle.textContent = "☰";
  });
});

// WhatsApp de contacto
document.getElementById("whatsappButton").addEventListener("click", (event) => {
  event.preventDefault();

  if (!/^\d{10,15}$/.test(WHATSAPP_NUMBER)) {
    alert("Configura primero el número de WhatsApp en script.js.");
    return;
  }

  const mensaje =
    "Hola, me interesa conocer sus trabajos de mármol y granito. ¿Me pueden proporcionar información y una cotización?";

  const url =
    `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(mensaje)}`;

  window.open(url, "_blank", "noopener,noreferrer");
});

// ===== CIFRAS Y TESTIMONIOS: EJEMPLOS, reemplázalos por datos reales =====
const CIFRAS = [
  { valor: 10, sufijo: "+", etiqueta: "Años de experiencia" },
  { valor: 500, sufijo: "+", etiqueta: "Piezas entregadas" },
  { valor: 300, sufijo: "+", etiqueta: "Clientes satisfechos" },
  { valor: 100, sufijo: "%", etiqueta: "Trabajo personalizado" }
];
const TESTIMONIOS = [
  { nombre: "María G.", lugar: "Cadereyta, Qro.", texto: "Quedó exactamente como lo imaginaba. El acabado de la lápida es impecable y cumplieron con la fecha." },
  { nombre: "Jorge R.", lugar: "San Juan del Río, Qro.", texto: "Nos hicieron la escalera a la medida. Muy buen trato y se nota el trabajo artesanal." },
  { nombre: "Laura M.", lugar: "Querétaro, Qro.", texto: "Pedí un comedor con cubierta de piedra y superó mis expectativas. Lo recomiendo ampliamente." }
];

function contar(el, meta, sufijo) {
  const reducir = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reducir) { el.textContent = meta + sufijo; return; }
  const t0 = performance.now();
  (function paso(t) {
    const p = Math.min((t - t0) / 1400, 1);
    el.textContent = Math.round(meta * (1 - Math.pow(1 - p, 3))) + sufijo;
    if (p < 1) requestAnimationFrame(paso);
  })(t0);
}

const statsGrid = document.getElementById("statsGrid");
CIFRAS.forEach((c) => {
  const d = document.createElement("div");
  d.className = "stat";
  d.innerHTML = '<strong>0</strong><span></span>';
  d.querySelector("span").textContent = c.etiqueta;
  statsGrid.appendChild(d);
});
if ("IntersectionObserver" in window) {
  const ioStats = new IntersectionObserver((es) => es.forEach((e) => {
    if (!e.isIntersecting) return;
    ioStats.disconnect();
    statsGrid.querySelectorAll(".stat strong").forEach((el, i) => contar(el, CIFRAS[i].valor, CIFRAS[i].sufijo));
  }), { threshold: 0.4 });
  ioStats.observe(statsGrid);
} else {
  statsGrid.querySelectorAll(".stat strong").forEach((el, i) => { el.textContent = CIFRAS[i].valor + CIFRAS[i].sufijo; });
}

const tGrid = document.getElementById("tGrid");
TESTIMONIOS.forEach((t) => {
  const c = document.createElement("blockquote");
  c.className = "t-card";
  c.innerHTML = '<div class="stars" aria-label="5 de 5 estrellas">★★★★★</div><p></p><footer><b></b><span></span></footer>';
  c.querySelector("p").textContent = t.texto;
  c.querySelector("b").textContent = t.nombre;
  c.querySelector("footer span").textContent = t.lugar;
  tGrid.appendChild(c);
});
revelar(document.querySelectorAll(".t-card"));

// Año automático
document.getElementById("year").textContent = new Date().getFullYear();

// Iniciar catálogo
pintarSesion();
abrirDesdeHash();
// ===== CARRITO =====
let carrito = leer("sm_cart", []);
const cartEl = document.getElementById("cart");
const cartBackdrop = document.getElementById("cartBackdrop");
const cartItems = document.getElementById("cartItems");
const mxnFmt = (n) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

function guardarCarrito() { guardar("sm_cart", carrito); pintarCarrito(); }

function agregarAlCarrito(t) {
  const it = carrito.find((x) => x.id === t.id);
  if (it) it.cantidad = Math.min(it.cantidad + 1, 20); else carrito.push({ id: t.id, cantidad: 1 });
  guardarCarrito();
  toast("Agregado al carrito 🛒");
}

function pintarCarrito() {
  carrito = carrito.filter((c) => trabajos.some((t) => t.id === c.id && typeof t.precio === "number"));
  cartItems.replaceChildren();
  let total = 0, cuantos = 0;

  carrito.forEach((c) => {
    const t = trabajos.find((x) => x.id === c.id);
    total += t.precio * c.cantidad; cuantos += c.cantidad;
    const row = document.createElement("div");
    row.className = "cart-row";
    row.innerHTML = '<img alt=""><div class="cart-info"><b></b><span class="id-badge"></span><span class="price"></span></div>' +
      '<div class="qty"><button type="button" data-d="-1" aria-label="Menos">−</button><span></span><button type="button" data-d="1" aria-label="Más">+</button></div>' +
      '<button type="button" class="cart-del" aria-label="Quitar">×</button>';
    row.querySelector("img").src = t.imagen;
    row.querySelector("b").textContent = t.nombre;
    row.querySelector(".id-badge").textContent = t.id;
    row.querySelector(".price").textContent = mxnFmt(t.precio * c.cantidad);
    row.querySelector(".qty span").textContent = c.cantidad;
    row.querySelectorAll(".qty button").forEach((b) => b.addEventListener("click", () => {
      c.cantidad = Math.min(c.cantidad + Number(b.dataset.d), 20);
      if (c.cantidad < 1) carrito = carrito.filter((x) => x !== c);
      guardarCarrito();
    }));
    row.querySelector(".cart-del").addEventListener("click", () => { carrito = carrito.filter((x) => x !== c); guardarCarrito(); });
    cartItems.appendChild(row);
  });

  if (!carrito.length) {
    const p = document.createElement("p");
    p.className = "cart-empty"; p.textContent = "Tu carrito está vacío.";
    cartItems.appendChild(p);
  }
  document.getElementById("cartTotal").textContent = mxnFmt(total);
  document.getElementById("cartCount").textContent = cuantos;
  document.getElementById("cartPay").disabled = !carrito.length;
}

const abrirCarrito = () => { cartEl.hidden = false; cartBackdrop.hidden = false; };
const cerrarCarrito = () => { cartEl.hidden = true; cartBackdrop.hidden = true; };
document.getElementById("cartBtn").addEventListener("click", abrirCarrito);
document.getElementById("cartClose").addEventListener("click", cerrarCarrito);
cartBackdrop.addEventListener("click", cerrarCarrito);
document.addEventListener("keydown", (e) => { if (e.key === "Escape") cerrarCarrito(); });

document.getElementById("cartPay").addEventListener("click", async (e) => {
  const b = e.currentTarget;
  b.disabled = true; b.textContent = "Redirigiendo…";
  try {
    const r = await fetch("/api/pagos/carrito", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: carrito, cliente: usuario ? usuario.nombre : "" })
    });
    const d = await r.json();
    if (d.url) { location.href = d.url; return; }
    toast(d.error || "No se pudo iniciar el pago");
  } catch { toast("No hay conexión con el servidor de pagos"); }
  b.disabled = false; b.textContent = "PAGAR CON TARJETA U OXXO";
});

pintarCarrito();

// ===== Términos, cotizador y folio =====
(function () {
  const termsModal = document.getElementById("termsModal");
  if (termsModal) {
    document.querySelectorAll(".terms-open").forEach((a) =>
      a.addEventListener("click", (e) => { e.preventDefault(); termsModal.hidden = false; }));
    document.getElementById("termsClose").addEventListener("click", () => { termsModal.hidden = true; });
    termsModal.addEventListener("click", (e) => { if (e.target === termsModal) termsModal.hidden = true; });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") termsModal.hidden = true; });
  }

  const cotForm = document.getElementById("cotForm");
  if (cotForm) {
    const cotTipo = document.getElementById("cotTipo");
    [...new Set(trabajos.map((t) => t.categoria))].forEach((c) => cotTipo.add(new Option(c, c)));
    cotTipo.add(new Option("Otro / diseño especial", "Otro"));
    cotForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const f = new FormData(cotForm);
      const l = (k, v) => (v ? `\n${k}: ${v}` : "");
      abrirWA(
        "Hola, quiero cotizar una pieza a medida." +
        l("Nombre", f.get("nombre")) + l("Pieza", f.get("tipo")) + l("Medidas", f.get("medidas")) +
        l("Material", f.get("material")) + l("Color/acabado", f.get("acabado")) + l("Notas", f.get("notas"))
      );
    });
  }

  const folioForm = document.getElementById("folioForm");
  if (folioForm) {
    folioForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const folio = document.getElementById("folioInput").value.trim().toUpperCase();
      if (folio) location.href = "pagar.html?orden=" + encodeURIComponent(folio);
    });
  }
})();