"use client";

import { useState, useTransition } from "react";
import { buscarClientesAccion, crearClienteRapido } from "../clientes/acciones";
import { infoCliente, type InfoCliente } from "./cliente-acciones";
import type { ClienteLista } from "@/lib/clientes";

const mx = (n: number) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

/** Elegir o dar de alta al cliente en el mostrador: aplica su lista de precios, crédito y puntos. */
export function ClienteVenta({ cliente, onCambio }: { cliente: InfoCliente | null; onCambio: (c: InfoCliente | null) => void }) {
  const [q, setQ] = useState("");
  const [res, setRes] = useState<ClienteLista[]>([]);
  const [nuevo, setNuevo] = useState(false);
  const [datos, setDatos] = useState({ nombre: "", telefono: "", codigo: "" });
  const [error, setError] = useState<string | null>(null);
  const [cargando, iniciar] = useTransition();

  const elegir = (id: string) => iniciar(async () => { onCambio(await infoCliente(id)); setRes([]); setQ(""); });

  if (cliente) return (
    <div className="rounded-xl bg-niebla p-3 text-[14px]">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold">{cliente.nombre}</p>
          <p className="text-[12px] text-secundario">Lista: {cliente.lista ?? "Público"} · {cliente.puntos} puntos ({mx(cliente.puntos * cliente.valorPunto)})</p>
          {cliente.credito.activo && <p className={`text-[12px] ${cliente.credito.vencido ? "font-semibold text-red-700" : "text-secundario"}`}>Crédito disponible {mx(cliente.credito.disponible ?? 0)}{cliente.credito.vencido ? ` · vencido ${mx(cliente.credito.vencido)}` : ""}</p>}
        </div>
        <button type="button" onClick={() => onCambio(null)} className="text-[12px] text-secundario">Quitar</button>
      </div>
    </div>
  );

  return (
    <div className="space-y-2">
      <div className="relative">
        <input value={q} onChange={(e) => { setQ(e.target.value); const t = e.target.value; if (t.trim().length >= 2) iniciar(async () => setRes(await buscarClientesAccion(t))); else setRes([]); }}
          placeholder="Cliente: nombre, teléfono o RFC (opcional)" className="h-11 w-full rounded-xl bg-niebla px-3 text-[15px] outline-none focus:bg-white focus:ring-2 focus:ring-azul/30" />
        {cargando && <span className="absolute right-3 top-3 text-[12px] text-secundario">…</span>}
        {res.length > 0 && (
          <ul className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-xl bg-white p-1 shadow-lg ring-1 ring-linea">
            {res.map((c) => <li key={c.id}><button type="button" onClick={() => elegir(c.id)} className="w-full rounded-lg px-3 py-2 text-left text-[14px] hover:bg-niebla">{c.nombre}<span className="block text-[12px] text-secundario">{[c.telefono, c.rfc, c.lista].filter(Boolean).join(" · ")}</span></button></li>)}
          </ul>
        )}
      </div>
      {!nuevo ? <button type="button" onClick={() => setNuevo(true)} className="text-[13px] text-azul">+ Cliente nuevo</button> : (
        <div className="grid gap-2 rounded-xl bg-niebla p-2">
          <input placeholder="Nombre" value={datos.nombre} onChange={(e) => setDatos({ ...datos, nombre: e.target.value })} className="h-10 rounded-lg border border-linea px-2" />
          <input placeholder="Teléfono" inputMode="tel" value={datos.telefono} onChange={(e) => setDatos({ ...datos, telefono: e.target.value })} className="h-10 rounded-lg border border-linea px-2" />
          <input placeholder="Código de quien lo recomendó (opcional)" value={datos.codigo} onChange={(e) => setDatos({ ...datos, codigo: e.target.value })} className="h-10 rounded-lg border border-linea px-2" />
          {error && <p className="text-[13px] text-red-700">{error}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={() => iniciar(async () => { const r = await crearClienteRapido(datos); if (r.error) setError(r.error); else { setNuevo(false); elegir(r.id!); } })} className="rounded-full bg-azul px-3 py-1.5 text-[13px] font-semibold text-white">Guardar</button>
            <button type="button" onClick={() => setNuevo(false)} className="text-[13px] text-secundario">Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}
