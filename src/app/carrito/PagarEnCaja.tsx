"use client";

import { useState, useTransition } from "react";
import QRCode from "qrcode";
import { useCarrito } from "@/components/carrito/CarritoProvider";
import { urlPanel } from "@/lib/etiqueta";
import { carritoParaCaja } from "./tienda-acciones";

/** En la tienda: el cliente enseña este QR (o dicta el código) en caja y el cajero carga su carrito para cobrar. */
export function PagarEnCaja() {
  const { lineas } = useCarrito();
  const catalogo = lineas.filter((l) => !l.especial);
  const [codigo, setCodigo] = useState<string | null>(null);
  const [qr, setQr] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();
  if (catalogo.length === 0) return null;

  const generar = () => iniciar(async () => {
    setError(null);
    const r = await carritoParaCaja(catalogo.map((l) => ({ id: l.id, cantidad: l.cantidad })));
    if (r.error || !r.codigo) { setError(r.error ?? "Intenta de nuevo."); return; }
    setQr(await QRCode.toString(urlPanel(`/interno/mostrador?carrito=${r.codigo}`), { type: "svg", margin: 1, errorCorrectionLevel: "M" }));
    setCodigo(r.codigo);
  });

  return (
    <section className="rounded-[20px] bg-[#E8F1FB] p-5">
      {codigo ? (
        <div className="flex flex-col items-center gap-3 text-center">
          <p className="font-semibold">Enseña este código en caja</p>
          <div className="h-56 w-56 rounded-2xl bg-white p-2 [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: qr }} />
          <p className="font-mono text-[32px] font-bold tracking-[0.25em] text-azul">{codigo}</p>
          <p className="text-[13px] text-secundario">En caja confirmamos solo lo que te llevas y pagas ahí. Si agregas algo más, genera otro código.</p>
          <button type="button" onClick={() => setCodigo(null)} className="text-[14px] text-azul underline">Volver</button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-semibold">¿Estás en la tienda?</p>
            <p className="text-[14px] text-secundario">Toma tus piezas y paga en caja con un código. Sin envío.</p>
          </div>
          <button type="button" disabled={enviando} onClick={generar} className="rounded-full bg-azul px-5 py-3 font-semibold text-white">{enviando ? "Generando…" : "Pagar en caja"}</button>
          {error && <p className="w-full text-[14px] font-semibold text-red-700">{error}</p>}
        </div>
      )}
    </section>
  );
}
