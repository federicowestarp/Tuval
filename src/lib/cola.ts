"use client";

import { aplicarCambio, type AccionCola, type RespuestaCola } from "@/app/cola-acciones";

/**
 * Cola de cambios hechos sin señal (IndexedDB del teléfono). Cada cambio lleva un id único y la hora real;
 * se envía solo al volver la señal y el servidor ignora los repetidos.
 */
export type Pendiente = {
  id: string;
  accion: AccionCola;
  campos: [string, FormDataEntryValue][];
  dueno: string;
  descripcion: string;
  creado: number;
  error?: string;
};

const BD = "tuval-sin-conexion";
const TABLA = "cola";
export const EVENTO_COLA = "tuval:cola";

function abrir(): Promise<IDBDatabase> {
  return new Promise((ok, no) => {
    const r = indexedDB.open(BD, 1);
    r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains(TABLA)) r.result.createObjectStore(TABLA, { keyPath: "id" }); };
    r.onsuccess = () => ok(r.result);
    r.onerror = () => no(r.error);
  });
}

async function tx<T>(modo: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await abrir();
  return new Promise((ok, no) => {
    const t = db.transaction(TABLA, modo);
    const r = f(t.objectStore(TABLA));
    t.oncomplete = () => { ok(r.result); db.close(); };
    t.onerror = () => { no(t.error); db.close(); };
  });
}

export const listarPendientes = () => tx<Pendiente[]>("readonly", (s) => s.getAll() as IDBRequest<Pendiente[]>).then((l) => l.sort((a, b) => a.creado - b.creado)).catch(() => [] as Pendiente[]);
const guardar = (p: Pendiente) => tx("readwrite", (s) => s.put(p));
const quitar = (id: string) => tx("readwrite", (s) => s.delete(id));
const avisar = () => window.dispatchEvent(new Event(EVENTO_COLA));

/** Dueño de la sesión actual en este teléfono (lo fija ModoSinConexion). Un cambio solo se envía con la sesión de quien lo hizo. */
export const duenoActual = () => { try { return localStorage.getItem("tuval.dueno") ?? ""; } catch { return ""; } };

const sinRed = (e: unknown) => e instanceof TypeError || /fetch|network|conexi/i.test(String((e as Error)?.message ?? e));

function armar(p: Pendiente): FormData {
  const fd = new FormData();
  for (const [k, v] of p.campos) fd.append(k, v);
  fd.set("_id", p.id);
  fd.set("_accion", p.accion);
  fd.set("_ocurrido", new Date(p.creado).toISOString());
  return fd;
}

export type ResultadoEnvio = { estado: "enviado"; respuesta: RespuestaCola } | { estado: "guardado" } | { estado: "error"; error: string };

/**
 * Envía el cambio; si no hay señal (o se cae a medio camino) lo guarda en el teléfono para enviarlo después.
 * `datos` puede ser un formulario o argumentos (se mandan como JSON en `_args`).
 */
export async function enviarOGuardar(accion: AccionCola, datos: FormData | unknown[] | Record<string, unknown>, descripcion: string): Promise<ResultadoEnvio> {
  const campos: [string, FormDataEntryValue][] = datos instanceof FormData ? [...datos.entries()] : [["_args", JSON.stringify(datos)]];
  const p: Pendiente = { id: crypto.randomUUID(), accion, campos, dueno: duenoActual(), descripcion, creado: Date.now() };
  if (navigator.onLine) {
    try {
      const respuesta = await aplicarCambio(armar(p));
      if (respuesta.sinSesion) { await guardar(p); avisar(); return { estado: "guardado" }; }
      if (!respuesta.ok) return { estado: "error", error: respuesta.error ?? "No se pudo guardar." };
      return { estado: "enviado", respuesta };
    } catch (e) {
      if (!sinRed(e)) return { estado: "error", error: "No se pudo guardar. Inténtalo de nuevo." };
    }
  }
  await guardar(p);
  avisar();
  return { estado: "guardado" };
}

let enCurso = false;
/** Envía lo pendiente de quien tiene la sesión abierta, en el orden en que se hizo. Devuelve cuántos se enviaron. */
export async function sincronizar(): Promise<number> {
  if (enCurso || !navigator.onLine) return 0;
  enCurso = true;
  let enviados = 0;
  try {
    const dueno = duenoActual();
    for (const p of await listarPendientes()) {
      if (p.error || p.dueno !== dueno) continue;
      try {
        const r = await aplicarCambio(armar(p));
        if (r.sinSesion) break;
        if (r.ok) { await quitar(p.id); enviados++; }
        else await guardar({ ...p, error: r.error ?? "No se pudo aplicar." });
      } catch (e) {
        if (sinRed(e)) break; // se volvió a ir la señal
        await guardar({ ...p, error: "El servidor no lo aceptó." });
      }
    }
  } finally {
    enCurso = false;
    avisar();
  }
  return enviados;
}

/** Descarta un cambio que el servidor rechazó (después de que la persona lo vio). */
export async function descartar(id: string) { await quitar(id); avisar(); }
