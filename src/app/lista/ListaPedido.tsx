"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useCarrito } from "@/components/carrito/CarritoProvider";
import { interpretarLista, subirLista, type LineaInterpretada } from "./acciones";

const NO_ESTA = "no-esta";

export function ListaPedido() {
  const { agregar, agregarEspecial, agregarAdjunto, adjuntos } = useCarrito();
  const [texto, setTexto] = useState("");
  const [lineas, setLineas] = useState<LineaInterpretada[] | null>(null);
  const [eleccion, setEleccion] = useState<Record<number, string>>({});
  const [cantidades, setCantidades] = useState<Record<number, number>>({});
  const [pendiente, iniciar] = useTransition();
  const [subiendo, setSubiendo] = useState(false);
  const [mensaje, setMensaje] = useState("");

  const buscar = () =>
    iniciar(async () => {
      const r = await interpretarLista(texto);
      setLineas(r);
      setEleccion(Object.fromEntries(r.map((l, i) => [i, l.sugerencias[0]?.id ?? NO_ESTA])));
      setCantidades(Object.fromEntries(r.map((l, i) => [i, l.cantidad])));
    });

  const agregarTodo = () => {
    lineas?.forEach((l, i) => {
      const cant = cantidades[i] ?? l.cantidad;
      const id = eleccion[i];
      const p = l.sugerencias.find((s) => s.id === id);
      if (p) agregar({ id: p.id, sku: p.sku, nombre: p.nombre, unidad: p.unidad }, cant);
      else agregarEspecial(l.descripcion, cant);
    });
    setMensaje(`Agregamos ${lineas?.length} partida(s) a tu carrito.`);
    setLineas(null);
    setTexto("");
  };

  async function alSubir(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setSubiendo(true);
    const fd = new FormData();
    fd.set("archivo", f);
    const r = await subirLista(fd);
    setSubiendo(false);
    e.target.value = "";
    if (r.error) return setMensaje(r.error);
    agregarAdjunto({ id: r.id!, nombre: r.nombre! });
    setMensaje("Listo. Adjuntamos tu lista al carrito; la revisamos y te confirmamos cada producto.");
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl bg-white p-4">
        <h2 className="font-display text-xl font-bold">Sube una foto o PDF de tu lista</h2>
        <p className="mt-1 text-sm text-acero">Lista a mano, cotización o requisición. Nosotros la capturamos y te confirmamos.</p>
        <label className="mt-3 flex cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-cian p-6 font-semibold text-azul">
          {subiendo ? "Subiendo…" : "📄 Tomar foto o elegir archivo"}
          <input type="file" accept="image/*,application/pdf" onChange={alSubir} className="sr-only" />
        </label>
        {adjuntos.length > 0 && (
          <p className="mt-2 text-sm">En tu carrito: {adjuntos.map((a) => a.nombre).join(", ")}</p>
        )}
      </section>

      <section className="rounded-xl bg-white p-4">
        <h2 className="font-display text-xl font-bold">O escríbela</h2>
        <p className="mt-1 text-sm text-acero">Un producto por renglón, con la cantidad al inicio. Ej.: <em>10 codos 90 1/2</em></p>
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={6}
          className="mt-3 w-full rounded-lg border border-cianclaro px-3 py-3 text-base outline-none focus:ring-4 focus:ring-cian"
          placeholder={"10 cople pvc 1/2\n2 válvula esfera 3/4\n1 bomba periférica"}
        />
        <button onClick={buscar} disabled={pendiente || !texto.trim()} className="mt-3 w-full rounded-xl bg-azul py-3 font-bold text-white disabled:opacity-50">
          {pendiente ? "Buscando…" : "Buscar en el catálogo"}
        </button>
      </section>

      {lineas && (
        <section className="space-y-3">
          {lineas.map((l, i) => (
            <div key={i} className="rounded-xl bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold">“{l.descripcion}”</p>
                <input
                  type="number"
                  min={1}
                  value={cantidades[i] ?? l.cantidad}
                  onChange={(e) => setCantidades({ ...cantidades, [i]: Math.max(1, Number(e.target.value)) })}
                  className="w-20 rounded-lg border border-cianclaro px-2 py-2 text-center"
                  aria-label="Cantidad"
                />
              </div>
              <div className="mt-2 space-y-2">
                {l.sugerencias.map((s) => (
                  <label key={s.id} className={`flex cursor-pointer items-center gap-3 rounded-lg border-2 p-3 text-sm ${eleccion[i] === s.id ? "border-azul bg-cianclaro" : "border-cianclaro"}`}>
                    <input type="radio" name={`l${i}`} checked={eleccion[i] === s.id} onChange={() => setEleccion({ ...eleccion, [i]: s.id })} />
                    <span>
                      <span className="font-semibold">{s.nombre}</span>
                      <span className="block text-xs text-acero">{Object.values(s.atributos).join(" · ")} · SKU {s.sku}</span>
                    </span>
                  </label>
                ))}
                <label className={`flex cursor-pointer items-center gap-3 rounded-lg border-2 p-3 text-sm ${eleccion[i] === NO_ESTA ? "border-azul bg-cianclaro" : "border-cianclaro"}`}>
                  <input type="radio" name={`l${i}`} checked={eleccion[i] === NO_ESTA} onChange={() => setEleccion({ ...eleccion, [i]: NO_ESTA })} />
                  <span>
                    <span className="font-semibold">{l.sugerencias.length ? "Ninguno es: búsquenlo ustedes" : "No está en el catálogo: búsquenlo ustedes"}</span>
                    <span className="block text-xs text-acero">Lo buscamos con nuestros proveedores y te avisamos.</span>
                  </span>
                </label>
              </div>
            </div>
          ))}
          <button onClick={agregarTodo} className="w-full rounded-xl bg-cian py-4 text-lg font-bold text-profundo">
            Agregar todo al carrito
          </button>
        </section>
      )}

      {mensaje && (
        <p className="rounded-xl bg-cianclaro p-4 text-sm font-semibold">
          {mensaje} <Link href="/carrito" className="underline">Ir al carrito</Link>
        </p>
      )}
    </div>
  );
}
