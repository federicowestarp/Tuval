/*
 * Tuval · modo sin conexión.
 * - Archivos de la app (JS, CSS, fuentes, logos): se guardan la primera vez y se sirven del teléfono.
 * - Pantallas: siempre se piden a internet; si no hay señal, se muestra la última copia guardada
 *   (o /sin-conexion si esa pantalla nunca se abrió en este teléfono).
 * - Los cambios (Server Actions, POST) nunca pasan por aquí: los maneja la cola de la app.
 */
const VERSION = "v1";
const ESTATICO = `tuval-estatico-${VERSION}`;
const PAGINAS = `tuval-paginas-${VERSION}`;
const MAX_PAGINAS = 150;
const MAX_ESTATICO = 400;
const ESPERA_RED_MS = 6000;
const BASE = ["/sin-conexion", "/marca/tuval-icono-app.svg", "/marca/tuval-simbolo-azul.svg"];

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    // La pantalla "Sin conexión" se guarda completa (con sus archivos) desde el primer momento.
    try { await guardarPagina(new Request(new URL("/sin-conexion", self.location.origin).href), await fetch("/sin-conexion")); } catch { /* se reintenta al precargar */ }
    try { await (await caches.open(ESTATICO)).addAll(BASE.slice(1)); } catch { /* no es crítico */ }
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys()
    .then((ks) => Promise.all(ks.filter((k) => k.startsWith("tuval-") && k !== ESTATICO && k !== PAGINAS).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

const mismaApp = (url) => url.origin === self.location.origin;
const esEstatico = (p) => p.startsWith("/_next/static/") || p.startsWith("/marca/") || p.startsWith("/fotos/") || p.startsWith("/archivos/") || p.startsWith("/_next/image") || p === "/icon.svg" || p === "/manifest.webmanifest";
const noGuardar = (p) => p.startsWith("/api/") || p.startsWith("/acceso/") || p === "/interno/entrar" || p.startsWith("/interno/activar");

async function recortar(nombre, max) {
  const c = await caches.open(nombre);
  const ks = await c.keys();
  for (let i = 0; i < ks.length - max; i++) await c.delete(ks[i]);
}

/** Guarda una pantalla con la hora en que se guardó (para el aviso "guardado hace X"). */
async function guardarPagina(req, res) {
  if (!res || !res.ok || res.redirected || !(res.headers.get("content-type") || "").includes("text/html")) return;
  const cuerpo = await res.clone().blob();
  const h = new Headers(res.headers);
  h.set("x-tuval-guardado", String(Date.now()));
  const c = await caches.open(PAGINAS);
  const url = new URL(req.url);
  await c.put(url.pathname + url.search, new Response(cuerpo, { status: 200, headers: h }));
  recortar(PAGINAS, MAX_PAGINAS);
  // También los archivos de la app que usa esa pantalla, para que funcione completa sin señal.
  try {
    const html = await cuerpo.text();
    const rutas = [...new Set(html.match(/\/_next\/static\/[^"'\s)\\]+/g) || [])].slice(0, 80);
    const e = await caches.open(ESTATICO);
    await Promise.all(rutas.map(async (r) => { if (!(await e.match(r))) { const x = await fetch(r).catch(() => null); if (x && x.ok) await e.put(r, x); } }));
  } catch { /* no es crítico */ }
}

async function paginaGuardada(url) {
  const c = await caches.open(PAGINAS);
  const guardada = (await c.match(url.pathname + url.search, { ignoreVary: true }))
    || (await c.match(url.pathname, { ignoreVary: true, ignoreSearch: true }));
  if (guardada) return guardada;
  // Nunca se abrió en este teléfono: se manda a la pantalla "Sin conexión" (con su propia dirección, para que cargue bien).
  if (url.pathname !== "/sin-conexion" && (await c.match("/sin-conexion", { ignoreVary: true }))) return Response.redirect("/sin-conexion", 302);
  return c.match("/sin-conexion", { ignoreVary: true });
}

async function navegar(req) {
  const url = new URL(req.url);
  try {
    const res = await Promise.race([
      fetch(req),
      new Promise((_, no) => setTimeout(() => no(new Error("lento")), ESPERA_RED_MS)),
    ]);
    if (!noGuardar(url.pathname)) guardarPagina(req, res.clone());
    return res;
  } catch {
    return (await paginaGuardada(url)) || new Response("Sin conexión", { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } });
  }
}

async function estatico(req) {
  const c = await caches.open(ESTATICO);
  const guardado = await c.match(req, { ignoreVary: true });
  const red = fetch(req).then((res) => {
    if (res.ok && res.type !== "opaque") { c.put(req, res.clone()); recortar(ESTATICO, MAX_ESTATICO); }
    return res;
  }).catch(() => guardado);
  // Lo inmutable de la app se sirve directo del teléfono; fotos y archivos se actualizan en segundo plano.
  return guardado || red;
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (!mismaApp(url)) return;
  // Navegación interna de Next (RSC): si falla sin señal, Next recarga la página completa y la atiende `navegar`.
  if (req.headers.get("RSC") === "1" || url.searchParams.has("_rsc")) return;
  if (req.mode === "navigate") { e.respondWith(navegar(req)); return; }
  if (esEstatico(url.pathname)) { e.respondWith(estatico(req)); return; }
});

self.addEventListener("message", (e) => {
  const d = e.data || {};
  if (d.tipo === "precargar" && Array.isArray(d.urls)) {
    e.waitUntil((async () => {
      const c = await caches.open(PAGINAS);
      for (const u of d.urls.slice(0, 40)) {
        try {
          const url = new URL(u, self.location.origin);
          if (!mismaApp(url) || noGuardar(url.pathname)) continue;
          const ya = await c.match(url.pathname + url.search, { ignoreVary: true });
          if (ya && Date.now() - Number(ya.headers.get("x-tuval-guardado") || 0) < (d.vigenciaMs || 120000)) continue;
          const res = await fetch(url.pathname + url.search, { credentials: "include", headers: { accept: "text/html" } });
          await guardarPagina(new Request(url.href), res);
        } catch { /* sin señal: se intenta la próxima vez */ }
      }
    })());
  }
  // Otra persona entró en este equipo: se borra lo guardado de la anterior (menos la pantalla "Sin conexión").
  if (d.tipo === "borrar") e.waitUntil(caches.open(PAGINAS).then(async (c) => {
    for (const k of await c.keys()) if (new URL(k.url).pathname !== "/sin-conexion") await c.delete(k);
  }));
  if (d.tipo === "cuando" && e.ports[0]) {
    caches.open(PAGINAS).then((c) => c.match(d.url, { ignoreVary: true, ignoreSearch: !d.url.includes("?") }))
      .then((r) => e.ports[0].postMessage(r ? Number(r.headers.get("x-tuval-guardado") || 0) : 0));
  }
});
