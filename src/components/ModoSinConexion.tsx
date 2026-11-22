"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import { descartar, duenoActual, EVENTO_COLA, listarPendientes, sincronizar, type Pendiente } from "@/lib/cola";

const suscribirRed = (f: () => void) => {
  window.addEventListener("online", f);
  window.addEventListener("offline", f);
  return () => { window.removeEventListener("online", f); window.removeEventListener("offline", f); };
};
/** true con señal. En el servidor se asume que sí. */
export const useEnLinea = () => useSyncExternalStore(suscribirRed, () => navigator.onLine, () => true);

const sw = () => navigator.serviceWorker?.controller ?? null;
const mandar = (msg: unknown) => sw()?.postMessage(msg);

function haceCuanto(ms: number): string {
  const m = Math.round((Date.now() - ms) / 60000);
  if (m < 1) return "hace un momento";
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  return h < 24 ? `hace ${h} h` : `hace ${Math.round(h / 24)} d`;
}

/** Pide al service worker cuándo se guardó la pantalla actual. */
function cuandoSeGuardo(url: string): Promise<number> {
  return new Promise((ok) => {
    const c = sw();
    if (!c) return ok(0);
    const canal = new MessageChannel();
    canal.port1.onmessage = (e) => ok(Number(e.data) || 0);
    c.postMessage({ tipo: "cuando", url }, [canal.port2]);
    setTimeout(() => ok(0), 1500);
  });
}

/**
 * Modo sin conexión para todos los perfiles:
 * registra el service worker, guarda las pantallas de tu perfil, avisa cuando no hay señal
 * y envía solos los cambios que se hicieron sin señal.
 */
export function ModoSinConexion() {
  const enLinea = useEnLinea();
  const ruta = usePathname();
  const router = useRouter();
  const [pendientes, setPendientes] = useState<Pendiente[]>([]);
  const [guardado, setGuardado] = useState(0);
  const [abierto, setAbierto] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const leerCola = useCallback(() => { listarPendientes().then(setPendientes); }, []);

  // Registro del service worker (solo en producción, para no estorbar en desarrollo).
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  }, []);

  // Al abrir con señal: quién soy (si cambió la persona en este equipo se borra lo guardado) y qué guardar de mi perfil.
  useEffect(() => {
    if (!enLinea) return;
    let vivo = true;
    const t = setTimeout(async () => {
      try {
        const r = await fetch("/api/sin-conexion", { cache: "no-store" });
        if (!r.ok || !vivo) return;
        const { dueno, urls } = (await r.json()) as { dueno: string; urls: string[] };
        let anterior = "";
        try { anterior = localStorage.getItem("tuval.dueno") ?? ""; localStorage.setItem("tuval.dueno", dueno); } catch { /* sin almacenamiento */ }
        await navigator.serviceWorker?.ready;
        if (anterior && anterior !== dueno) mandar({ tipo: "borrar" });
        mandar({ tipo: "precargar", urls, vigenciaMs: 10 * 60_000 });
        leerCola();
        const enviados = await sincronizar();
        if (enviados && vivo) router.refresh();
      } catch { /* sin señal real aunque el navegador diga que sí */ }
    }, 300);
    return () => { vivo = false; clearTimeout(t); };
    // Se revisa en cada cambio de pantalla: entrar o salir de sesión es una navegación sin recargar.
  }, [enLinea, router, ruta, leerCola]);

  // Cada pantalla que abres queda guardada para verla sin señal.
  useEffect(() => {
    if (!enLinea) return;
    const t = setTimeout(() => mandar({ tipo: "precargar", urls: [location.pathname + location.search], vigenciaMs: 120_000 }), 1500);
    return () => clearTimeout(t);
  }, [ruta, enLinea]);

  // Sin señal: cuándo se guardó lo que estás viendo.
  useEffect(() => {
    if (enLinea) return;
    let vivo = true;
    cuandoSeGuardo(location.pathname + location.search).then((t) => { if (vivo) setGuardado(t); });
    return () => { vivo = false; };
  }, [enLinea, ruta]);

  // Cola: se lee al abrir y cada vez que cambia; mientras haya pendientes se reintenta cada 30 s.
  useEffect(() => {
    leerCola();
    window.addEventListener(EVENTO_COLA, leerCola);
    return () => window.removeEventListener(EVENTO_COLA, leerCola);
  }, [leerCola]);
  const dueno = pendientes.length ? duenoActual() : "";
  const ajenos = pendientes.filter((p) => !p.error && p.dueno !== dueno);
  const porEnviar = pendientes.filter((p) => !p.error && p.dueno === dueno).length;
  useEffect(() => {
    if (!enLinea || porEnviar === 0) return;
    const t = setInterval(() => { sincronizar().then((n) => { if (n) router.refresh(); }); }, 30_000);
    return () => clearInterval(t);
  }, [enLinea, porEnviar, router]);

  // Algo que necesita señal falló sin señal: se dice claro en vez de quedarse "cargando".
  useEffect(() => {
    const f = (e: PromiseRejectionEvent) => {
      if (navigator.onLine && !/fetch|network/i.test(String(e.reason?.message ?? e.reason))) return;
      setAviso("Eso necesita señal y no se guardó. Inténtalo cuando vuelva la conexión.");
      setTimeout(() => setAviso(null), 6000);
    };
    window.addEventListener("unhandledrejection", f);
    return () => window.removeEventListener("unhandledrejection", f);
  }, []);

  const fallidos = pendientes.filter((p) => p.error);
  if (enLinea && pendientes.length === 0 && !aviso) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+5rem)] z-[90] flex justify-center px-4 md:bottom-6 print:hidden">
      <div className="pointer-events-auto w-full max-w-md rounded-[20px] border border-linea bg-white/95 p-3 text-[14px] shadow-[0_8px_24px_rgb(11_46_92/0.12)] backdrop-blur-xl" role="status" aria-live="polite">
        <button type="button" onClick={() => setAbierto(!abierto)} className="flex w-full items-center gap-3 text-left">
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${enLinea ? "bg-cian" : "bg-secundario"}`} />
          <span className="min-w-0 flex-1">
            {aviso ? <strong>{aviso}</strong> : !enLinea ? (
              <><strong>Sin conexión.</strong> <span className="text-secundario">{guardado ? `Lo que ves se guardó ${haceCuanto(guardado)}.` : "Puedes seguir trabajando."}</span></>
            ) : porEnviar > 0 ? <strong>Enviando {porEnviar} cambio{porEnviar === 1 ? "" : "s"} guardado{porEnviar === 1 ? "" : "s"}…</strong>
              : fallidos.length ? <strong>{fallidos.length} cambio{fallidos.length === 1 ? "" : "s"} no se pudo aplicar</strong>
              : <strong>{ajenos.length} cambio{ajenos.length === 1 ? "" : "s"} de otra sesión: se envía{ajenos.length === 1 ? "" : "n"} cuando esa persona vuelva a entrar</strong>}
            {!enLinea && porEnviar > 0 && <span className="block text-secundario">{porEnviar} cambio{porEnviar === 1 ? "" : "s"} por enviar: se mandan solos al volver la señal.</span>}
          </span>
          {pendientes.length > 0 && <span className="shrink-0 font-semibold text-azul">{abierto ? "Ocultar" : "Ver"}</span>}
        </button>
        {abierto && pendientes.length > 0 && (
          <ul className="mt-2 max-h-56 space-y-1.5 overflow-auto border-t border-linea pt-2">
            {pendientes.map((p) => (
              <li key={p.id} className="flex items-start justify-between gap-2">
                <span className="min-w-0">
                  <span className="block">{p.descripcion}</span>
                  <span className={`block text-[12px] ${p.error ? "font-semibold text-red-700" : "text-secundario"}`}>
                    {p.error ?? `Hecho ${new Date(p.creado).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })} · ${p.dueno === dueno ? "por enviar" : "de otra sesión"}`}
                  </span>
                </span>
                {(p.error || p.dueno !== dueno) && <button type="button" onClick={() => descartar(p.id)} className="shrink-0 text-[13px] font-semibold text-azul">Quitar</button>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
