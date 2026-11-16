"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { IconoBuscar, IconoCamara, IconoCerrar, IconoLista } from "@/components/Iconos";
import { useCarrito } from "@/components/carrito/CarritoProvider";
import { subirLista } from "@/app/lista/acciones";
import { clasesBoton } from "@/components/ui";

/**
 * Una sola caja para todo:
 *  · escribes → resultados al instante
 *  · pegas varios renglones → se vuelve "pedido con lista"
 *  · cámara → foto o PDF de tu lista; la capturamos nosotros
 */
export function Buscador({ inicial = "", grande = false, autoFocus = false }: { inicial?: string; grande?: boolean; autoFocus?: boolean }) {
  const router = useRouter();
  const ruta = usePathname();
  const { agregarAdjunto } = useCarrito();
  const [q, setQ] = useState(inicial);
  const [lista, setLista] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [, iniciar] = useTransition();
  const archivo = useRef<HTMLInputElement>(null);
  const primera = useRef(true);

  // En la tienda, los resultados se actualizan mientras escribes.
  useEffect(() => {
    if (primera.current) { primera.current = false; return; }
    if (ruta !== "/tienda") return;
    const t = setTimeout(() => iniciar(() => router.replace(q.trim() ? `/tienda?q=${encodeURIComponent(q.trim())}` : "/tienda", { scroll: false })), 250);
    return () => clearTimeout(t);
  }, [q, ruta, router]);

  const enviar = (e: React.FormEvent) => {
    e.preventDefault();
    if (q.trim()) router.push(`/tienda?q=${encodeURIComponent(q.trim())}`);
  };

  const alPegar = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const texto = e.clipboardData.getData("text");
    if (texto.includes("\n") && texto.trim().split(/\r?\n/).filter((l) => l.trim()).length > 1) {
      e.preventDefault();
      setLista(texto);
    }
  };

  async function alElegirArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setSubiendo(true);
    const fd = new FormData();
    fd.set("archivo", f);
    const r = await subirLista(fd);
    setSubiendo(false);
    if (r.error) return setAviso(r.error);
    agregarAdjunto({ id: r.id!, nombre: r.nombre! });
    setAviso("Listo, agregamos tu lista al carrito. La capturamos y te confirmamos cada producto.");
  }

  const renglones = lista?.trim().split(/\r?\n/).filter((l) => l.trim()).length ?? 0;

  return (
    <div className="w-full">
      <form onSubmit={enviar} className={`flex items-center gap-2 rounded-full bg-niebla pl-5 pr-1.5 ring-cian transition focus-within:bg-white focus-within:ring-2 ${grande ? "h-16" : "h-12"}`}>
        <IconoBuscar className="h-5 w-5 shrink-0 text-acero" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onPaste={alPegar}
          autoFocus={autoFocus}
          enterKeyHint="search"
          placeholder={grande ? "Busca por producto o medida, o pega tu lista" : "Buscar: cople 1/2, válvula…"}
          className={`h-full min-w-0 flex-1 bg-transparent text-profundo outline-none placeholder:text-acero/70 ${grande ? "text-[17px] sm:text-lg" : "text-[16px]"}`}
          aria-label="Buscar productos"
        />
        {q && (
          <button type="button" onClick={() => setQ("")} aria-label="Borrar" className="flex h-9 w-9 items-center justify-center rounded-full text-acero hover:bg-white">
            <IconoCerrar className="h-4 w-4" />
          </button>
        )}
        <button
          type="button"
          onClick={() => archivo.current?.click()}
          aria-label="Subir foto o PDF de tu lista"
          className={`flex shrink-0 items-center justify-center rounded-full bg-white text-azul shadow-sm hover:bg-cianclaro ${grande ? "h-12 w-12" : "h-9 w-9"}`}
        >
          {subiendo ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-azul border-t-transparent" /> : <IconoCamara className="h-5 w-5" />}
        </button>
        <input ref={archivo} type="file" accept="image/*,application/pdf" onChange={alElegirArchivo} className="sr-only" />
      </form>

      {lista && (
        <div className="aparecer mt-3 rounded-3xl bg-white p-5 text-left ring-1 ring-linea">
          <p className="flex items-center gap-2 font-semibold"><IconoLista className="h-5 w-5 text-cian" /> Pegaste una lista de {renglones} productos</p>
          <p className="mt-1 text-sm text-acero">Buscamos cada uno en el catálogo. Lo que no tengamos, lo conseguimos.</p>
          <div className="mt-4 flex gap-2">
            <button type="button" onClick={() => { sessionStorage.setItem("tuval.lista", lista); router.push("/lista?pegada=1"); }} className={clasesBoton("principal", "normal")}>
              Buscar todos
            </button>
            <button type="button" onClick={() => setLista(null)} className={clasesBoton("fantasma", "normal")}>Cancelar</button>
          </div>
        </div>
      )}

      {aviso && (
        <div className="aparecer mt-3 flex items-start justify-between gap-3 rounded-3xl bg-cianclaro p-4 text-left text-[15px]">
          <p>{aviso} <Link href="/carrito" className="font-semibold underline">Ver carrito</Link></p>
          <button onClick={() => setAviso(null)} aria-label="Cerrar"><IconoCerrar className="h-4 w-4" /></button>
        </div>
      )}
    </div>
  );
}
