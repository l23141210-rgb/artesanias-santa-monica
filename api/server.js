// API mínima de cuentas (sin dependencias). Guarda usuarios en /data/usuarios.json
const http = require("http"), fs = require("fs"), path = require("path"), crypto = require("crypto");
const FILE = process.env.DATA_FILE || "/data/usuarios.json";
const load = () => { try { return JSON.parse(fs.readFileSync(FILE)); } catch { return { users: {}, tokens: {} }; } };
const save = (d) => { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(d, null, 1)); };
const hash = (p, s) => crypto.scryptSync(p, s, 32).toString("hex");
const send = (r, c, o) => { r.writeHead(c, { "Content-Type": "application/json" }); r.end(JSON.stringify(o)); };

http.createServer((q, r) => {
  if (q.method !== "POST") return send(r, 405, { error: "Método no permitido" });
  let b = "";
  q.on("data", (c) => { b += c; if (b.length > 1e4) q.destroy(); });
  q.on("end", () => {
    let x; try { x = JSON.parse(b); } catch { return send(r, 400, { error: "JSON inválido" }); }
    const d = load(), email = String(x.email || "").trim().toLowerCase();
    const sesion = (u) => {
      const t = crypto.randomBytes(24).toString("hex");
      d.tokens[t] = email; save(d);
      send(r, 200, { nombre: u.nombre, email, token: t });
    };
    if (q.url === "/api/registro") {
      const nombre = String(x.nombre || "").trim().slice(0, 80), pass = String(x.password || "");
      if (!nombre || !/^\S+@\S+\.\S+$/.test(email) || pass.length < 6) return send(r, 400, { error: "Datos inválidos" });
      if (d.users[email]) return send(r, 409, { error: "Ese correo ya está registrado. Inicia sesión." });
      const salt = crypto.randomBytes(16).toString("hex");
      d.users[email] = { nombre, telefono: String(x.telefono || "").slice(0, 20), salt, pass: hash(pass, salt), creado: new Date().toISOString() };
      return sesion(d.users[email]);
    }
    if (q.url === "/api/login") {
      const u = d.users[email];
      if (!u || !crypto.timingSafeEqual(Buffer.from(hash(String(x.password || ""), u.salt)), Buffer.from(u.pass)))
        return send(r, 401, { error: "Correo o contraseña incorrectos." });
      return sesion(u);
    }
    send(r, 404, { error: "No existe" });
  });
}).listen(3000, () => console.log("API en :3000"));
