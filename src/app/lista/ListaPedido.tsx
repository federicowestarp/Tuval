"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useCarrito } from "@/components/carrito/CarritoProvider";
import { IconoCamara, IconoCheck, IconoDocumento } from "@/components/Iconos";
import { areaTexto, clasesBoton } from "@/components/ui";
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
  const [listo, setListo] = useState<string | null>(null);
  const archivo = useRef<HTMLInputElement>(null);

  const buscar = (t: string) =>
    iniciar(async () => {
      const r = await interpretarLista(t);
      setLineas(r);
      setEleccion(Object.fromEntries(r.map((l, i) => [i, l.sugerencias[0]?.id ?? NO_ESTA])));
      setCantidades(Object.fromEntries(r.map((l, i) => [i, l.cantidad])));
    });

  // Lista pegada en el buscador de la tienda o del inicio.
  useEffect(() => {
    const pegada = sessionStorage.getItem("tuval.lista");
    if (pegada) {
      sessionStorage.removeItem("tuval.lista");
      // eslint-disable-next-line react-hooks/set-state-in-effect -- precargar lista pegada en otra pantalla
      setTexto(pegada);
      buscar(pegada);
    }
  }, []);

  const agregarTodo = () => {
    lineas?.forEach((l, i) => {
      const cant = cantidades[i] ?? l.cantidad;
      const p = l.sugerencias.find((s) => s.id === eleccion[i]);
      if (p) agregar({ id: p.id, sku: p.sku, nombre: p.nombre, unidad: p.unidad }, cant);
      else agregarEspecial(l.descripcion, cant);
    });
    setListo(`Agregamos ${lineas?.length} producto${lineas?.length === 1 ? "" : "s"} a tu carrito.`);
    setLineas(null);
    setTexto("");
  };

  async function alSubir(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setSubiendo(true);
    const fd = new FormData();
    fd.set("archivo", f);
    const r = await subirLista(fd);
    setSubiendo(false);
    if (r.error) return setListo(r.error);
    agregarAdjunto({ id: r.id!, nombre: r.nombre! });
    setListo("Tu lista está en el carrito. La capturamos y te confirmamos cada producto.");
  }

  const porBuscar = lineas ? lineas.filter((_, i) => eleccion[i] === NO_ESTA).length : 0;

  return (
    <div className="space-y-4">
      {/* Opción 1: foto o PDF */}
      <button
        type="button"
        onClick={() => archivo.current?.click()}
        className="flex w-full items-center gap-4 rounded-[20px] bg-niebla p-5 text-left transition hover:bg-piedra"
      >
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white text-azul">
          {subiendo ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-azul border-t-transparent" /> : <IconoCamara className="h-7 w-7" />}
        </span>
        <span>
          <span className="block text-[17px] font-semibold">Foto o PDF de tu lista</span>
          <span className="block text-[15px] text-secundario">Requisición, cotización o lista a mano. Nosotros la capturamos.</span>
        </span>
      </button>
      <input ref={archivo} type="file" accept="image/*,application/pdf" onChange={alSubir} className="sr-only" />
      {adjuntos.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {adjuntos.map((a) => (
            <span key={a.id} className="inline-flex items-center gap-1.5 rounded-full bg-piedra px-3 py-1.5 text-[13px] font-medium">
              <IconoDocumento className="h-4 w-4" /> {a.nombre}
            </span>
          ))}
        </div>
      )}

      {/* Opción 2: escribirla */}
      <div className="rounded-[20px] bg-niebla p-5">
        <p className="text-[17px] font-semibold">O escríbela</p>
        <p className="text-[15px] text-secundario">Un producto por renglón, con la cantidad al inicio.</p>
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={5}
          className={`mt-4 bg-white ${areaTexto}`}
          placeholder={"10 cople pvc 1/2\n2 válvula esfera 3/4\n1 bomba periférica"}
        />
        <button onClick={() => buscar(texto)} disabled={pendiente || !texto.trim()} className={`mt-3 ${clasesBoton("principal", "grande", true)}`}>
          {pendiente ? "Buscando…" : "Buscar en el catálogo"}
        </button>
      </div>

      {lineas && (
        <div className="aparecer space-y-3 pt-4">
          <h2 className="font-display text-2xl font-semibold">Revisa tu lista</h2>
          {lineas.map((l, i) => (
            <div key={i} className="rounded-[20px] bg-white p-4 ring-1 ring-linea">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[15px] text-secundario">“{l.descripcion}”</p>
                <input
                  type="number"
                  min={1}
                  inputMode="numeric"
                  value={cantidades[i] ?? l.cantidad}
                  onChange={(e) => setCantidades({ ...cantidades, [i]: Math.max(1, Number(e.target.value)) })}
                  className="h-10 w-16 rounded-xl bg-niebla text-center text-[15px] font-semibold outline-none focus:ring-2 focus:ring-azul/30"
                  aria-label="Cantidad"
                />
              </div>
              <div className="mt-3 space-y-1.5">
                {[...l.sugerencias.map((s) => ({ id: s.id, t: s.nombre, d: Object.values(s.atributos).join(" · ") || s.sku })),
                  { id: NO_ESTA, t: l.sugerencias.length ? "Ninguno de estos" : "No está en catálogo", d: "Lo buscamos con proveedores y te avisamos" }].map((o) => (
                  <label key={o.id} className={`flex cursor-pointer items-center gap-3 rounded-2xl p-3 transition ${eleccion[i] === o.id ? "bg-piedra" : "hover:bg-niebla"}`}>
                    <input type="radio" name={`l${i}`} checked={eleccion[i] === o.id} onChange={() => setEleccion({ ...eleccion, [i]: o.id })} className="sr-only" />
                    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${eleccion[i] === o.id ? "bg-azul text-white" : "ring-1 ring-secundario/40"}`}>
                      {eleccion[i] === o.id && <IconoCheck className="h-3.5 w-3.5" />}
                    </span>
                    <span>
                      <span className="block text-[15px] font-semibold">{o.t}</span>
                      <span className="block text-[13px] text-secundario">{o.d}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ))}
          <div className="sticky bottom-20 pt-2 md:bottom-4">
            <button onClick={agregarTodo} className={`${clasesBoton("principal", "grande", true)} shadow-lg`}>
              Agregar {lineas.length} al carrito{porBuscar > 0 && ` · ${porBuscar} por buscar`}
            </button>
          </div>
        </div>
      )}

      {listo && (
        <div className="aparecer flex items-center justify-between gap-3 rounded-[20px] bg-piedra p-5">
          <p className="text-[15px] font-medium">{listo}</p>
          <Link href="/carrito" className={clasesBoton("principal", "chico")}>Ver carrito</Link>
        </div>
      )}
    </div>
  );
}
