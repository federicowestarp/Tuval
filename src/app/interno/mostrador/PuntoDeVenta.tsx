"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { EscanerQR, codigoCarritoDeQr, skuDeQr } from "@/components/interno/EscanerQR";
import { cargarCarritoTienda, darAccesoCelular, productoPorEtiqueta, verificarCelular } from "./tienda-acciones";
import QRCode from "qrcode";
import type { ProductoMostrador } from "@/lib/inventario";
import { BuscadorProducto } from "@/components/interno/BuscadorProducto";
import { Segmentado } from "@/components/Segmentado";
import { campo, clasesBoton, etiqueta } from "@/components/ui";
import { registrarVenta } from "./acciones";
import { ClienteVenta } from "./ClienteVenta";
import { infoCliente, preciosDeLista, type InfoCliente } from "./cliente-acciones";
import { Dictado } from "./Dictado";
import { sinIva, totalesVenta } from "@/lib/totales";
import { InventarioFocos, type ProductoInventario } from "./InventarioFocos";

type Linea = ProductoMostrador & { cantidad: number; manual: string };
const IVA = 0.16;
const mx = (n: number) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

export function PuntoDeVenta({ inventario, categorias, terminales = [] }: { inventario: ProductoInventario[]; categorias: { id: string; nombre: string }[]; terminales?: { id: string; nombre: string }[] }) {
  const [terminal, setTerminal] = useState(terminales.length === 1 ? terminales[0].id : "");
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [forma, setForma] = useState<"efectivo" | "tarjeta" | "transferencia" | "credito">("efectivo");
  const [ficha, setFicha] = useState<InfoCliente | null>(null);
  const [preciosLista, setPreciosLista] = useState<Record<string, number | null>>({});
  const [usarPuntos, setUsarPuntos] = useState(false);
  const [comprobante, setComprobante] = useState<"nota" | "factura">("nota");
  const [recibido, setRecibido] = useState("");
  const [referencia, setReferencia] = useState("");
  const [cliente, setCliente] = useState({ nombre: "", telefono: "", rfc: "", razon: "", cp: "", regimen: "", uso: "G03" });
  const [error, setError] = useState<string | null>(null);
  const [hecha, setHecha] = useState<{ id: string; folio: string; cambio: number; pendiente: boolean } | null>(null);
  const [enviando, iniciar] = useTransition();
  // Carrito armado por el cliente en la tienda (QR o código) y lector de QR (carrito o etiqueta de anaquel).
  const [carrito, setCarrito] = useState<{ id: string; codigo: string; telefono: string | null; verificado: boolean } | null>(null);
  const [accesoQr, setAccesoQr] = useState<string | null>(null);
  const [escaneando, setEscaneando] = useState(false);
  const [codigoCarrito, setCodigoCarrito] = useState("");
  const [avisoQr, setAvisoQr] = useState<string | null>(null);
  const params = useSearchParams();
  const cargarCarrito = async (codigo: string) => {
    setAvisoQr(null);
    const r = await cargarCarritoTienda(codigo);
    if (r.error || !r.id) { setAvisoQr(r.error ?? "No se pudo cargar."); return; }
    setHecha(null); setAccesoQr(null);
    setLineas(r.lineas!.map((x) => ({ ...x.producto, cantidad: x.cantidad, manual: "" })));
    setCarrito({ id: r.id, codigo: codigo.toUpperCase(), telefono: r.telefono ?? null, verificado: !!r.verificado });
    if (r.clienteId) { const f = await infoCliente(r.clienteId); if (f) setFicha(f); }
    setAvisoQr(`Carrito ${codigo.toUpperCase()} cargado${r.vendedor ? ` (lo armó ${r.vendedor})` : ""}: confirma con el cliente lo que se lleva y ajusta cantidades antes de cobrar.`);
  };
  const leerQr = async (texto: string) => {
    setEscaneando(false);
    const codigo = codigoCarritoDeQr(texto);
    if (codigo) { await cargarCarrito(codigo); return; }
    const sku = skuDeQr(texto) ?? (/^[A-Za-z0-9-]{2,60}$/.test(texto.trim()) ? texto.trim() : null);
    if (sku) { const p = await productoPorEtiqueta(sku); if (p) { agregar(p); setAvisoQr(`Agregado: ${p.nombre}`); } else setAvisoQr(`No encontré el producto ${sku}.`); return; }
    setAvisoQr("Ese QR no es de un carrito ni de una etiqueta de Tuval.");
  };
  const desdeUrl = params.get("carrito");
  useEffect(() => {
    // Si la tablet abrió la liga del QR con la cámara normal: …/interno/mostrador?carrito=ABC123
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga única desde la liga
    if (desdeUrl) cargarCarrito(desdeUrl);
     
  }, [desdeUrl]);

  const agregar = (p: ProductoMostrador, cantidad = 1) => {
    setHecha(null);
    setLineas((ls) => {
      const i = ls.findIndex((l) => l.id === p.id);
      if (i >= 0) return ls.map((l, j) => (j === i ? { ...l, cantidad: l.cantidad + cantidad } : l));
      return [...ls, { ...p, cantidad, manual: "" }];
    });
  };
  // Mismo cálculo que el servidor (src/lib/totales.ts): total con IVA por renglón, sin centavos fantasma.
  const precioSinIva = (l: Linea) => { const pl = ficha ? preciosLista[l.id] : undefined; return pl != null ? pl : l.precio != null ? l.precio : sinIva(Number(l.manual) || 0); };
  const precioConIva = (l: Linea) => precioSinIva(l) * (1 + IVA);
  const { total } = totalesVenta(lineas.map((l) => ({ precio: precioSinIva(l), cantidad: l.cantidad })));
  const descuentoPuntos = ficha && usarPuntos ? Math.min(ficha.puntos * ficha.valorPunto, total) : 0;
  const porCobrar = Math.round((total - descuentoPuntos) * 100) / 100;
  const cambio = forma === "efectivo" ? (Number(recibido) || 0) - porCobrar : 0;
  // Precios de la lista del cliente para lo que está en la venta.
  const idsVenta = lineas.map((l) => l.id).join(",");
  useEffect(() => {
    if (!ficha || !idsVenta) return;
    let vivo = true;
    preciosDeLista(idsVenta.split(","), ficha.listaId).then((p) => { if (vivo) setPreciosLista(p); });
    return () => { vivo = false; };
  }, [ficha, idsVenta]);
  const sinExistencia = lineas.filter((l) => l.cantidad > l.existencia);

  const cobrar = () => {
    setError(null);
    iniciar(async () => {
      const r = await registrarVenta({
        lineas: lineas.map((l) => ({ id: l.id, cantidad: l.cantidad, precio: l.precio == null ? Number(l.manual) || null : null })),
        forma, terminal: forma === "tarjeta" ? terminal : null, recibido: Number(recibido) || null, referencia, comprobante, cliente,
        clienteId: ficha?.id ?? null, puntos: usarPuntos && ficha ? ficha.puntos : 0, carritoId: carrito?.id ?? null,
      });
      if (r.error) { setError(r.error); return; }
      setHecha({ id: r.id!, folio: r.folio!, cambio, pendiente: !!r.pendiente });
      setLineas([]); setRecibido(""); setReferencia(""); setCarrito(null); setAvisoQr(null);
      setCliente({ nombre: "", telefono: "", rfc: "", razon: "", cp: "", regimen: "", uso: "G03" });
      setFicha(null); setUsarPuntos(false); setForma("efectivo");
    });
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
      <section className="space-y-3 rounded-[20px] bg-white p-4">
        <BuscadorProducto onElegir={(p) => agregar(p)} />
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setEscaneando(true)} className="rounded-full bg-azul px-4 py-2 text-[14px] font-semibold text-white">Escanear QR (carrito o etiqueta)</button>
          <form onSubmit={(e) => { e.preventDefault(); if (codigoCarrito.trim()) cargarCarrito(codigoCarrito); setCodigoCarrito(""); }} className="flex items-center gap-1">
            <input value={codigoCarrito} onChange={(e) => setCodigoCarrito(e.target.value.toUpperCase())} maxLength={6} placeholder="Código" aria-label="Código de carrito" className="h-9 w-32 rounded-full border border-linea px-3 font-mono uppercase" />
            <button className="h-9 rounded-full border border-azul px-3 text-[14px] font-semibold text-azul">Cargar</button>
          </form>
          {carrito && <span className="rounded-full bg-[#E8F1FB] px-3 py-1 text-[13px] font-semibold text-azul">Carrito {carrito.codigo}</span>}
        </div>
        {avisoQr && <p className="rounded-xl bg-niebla px-3 py-2 text-[14px]">{avisoQr}</p>}
        {carrito?.telefono && !carrito.verificado && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#E8F1FB] px-3 py-2 text-[14px]">
            <span>Celular que dejó: <strong className="font-mono">{carrito.telefono}</strong>. Pídele que te lo diga y su nombre para darlo de alta.</span>
            <button type="button" onClick={async () => {
              const r = await verificarCelular(carrito.id);
              if (r.error || !r.clienteId) { setAvisoQr(r.error ?? "No se pudo."); return; }
              const f = await infoCliente(r.clienteId); if (f) setFicha(f);
              setCarrito({ ...carrito, verificado: true });
              setAvisoQr("Celular confirmado: queda dado de alta y esta compra le suma puntos. Revisa que el nombre de la ficha sea el suyo.");
            }} className="rounded-full bg-azul px-3 py-1.5 font-semibold text-white">Confirmé su celular</button>
          </div>
        )}
        {escaneando && <EscanerQR titulo="Escanea el carrito del cliente o una etiqueta" onLeer={leerQr} onCerrar={() => setEscaneando(false)} />}
        <Dictado onAgregar={agregar} />
        {hecha && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-niebla p-4">
            <p className="font-semibold">Venta {hecha.folio} registrada{hecha.cambio > 0 && !hecha.pendiente && <> · Cambio: <span className="text-azul">{mx(hecha.cambio)}</span></>}
              {hecha.pendiente && <span className="block text-amber-800">Pendiente de pago por transferencia: no entregues la mercancía hasta que se confirme.</span>}</p>
            <Link href={`/interno/mostrador/ticket/${hecha.id}`} target="_blank" className={clasesBoton("secundario", "chico")}>Imprimir ticket</Link>
          </div>
        )}
        {lineas.length === 0 ? (
          <p className="py-10 text-center text-secundario">Escanea un código o busca un producto.</p>
        ) : (
          <ul className="divide-y divide-linea">
            {lineas.map((l, i) => (
              <li key={l.id} className="grid grid-cols-[1fr_auto] items-center gap-3 py-3 sm:grid-cols-[1fr_auto_auto_auto]">
                <div className="min-w-0">
                  <p className="truncate text-[15px]">{l.nombre}</p>
                  <p className={`text-[12px] ${l.cantidad > l.existencia ? "text-red-700" : "text-secundario"}`}>{l.sku} · {l.existencia} en sucursal</p>
                </div>
                <div className="flex items-center gap-1">
                  <button type="button" aria-label="Menos" onClick={() => setLineas((ls) => ls.map((x, j) => (j === i ? { ...x, cantidad: Math.max(1, x.cantidad - 1) } : x)))} className="h-9 w-9 rounded-full bg-niebla text-lg">−</button>
                  <input aria-label="Cantidad" inputMode="decimal" value={l.cantidad} onChange={(e) => setLineas((ls) => ls.map((x, j) => (j === i ? { ...x, cantidad: Math.max(0, Number(e.target.value) || 0) } : x)))} className="h-9 w-14 rounded-lg border border-linea text-center tabular-nums" />
                  <button type="button" aria-label="Más" onClick={() => setLineas((ls) => ls.map((x, j) => (j === i ? { ...x, cantidad: x.cantidad + 1 } : x)))} className="h-9 w-9 rounded-full bg-niebla text-lg">+</button>
                </div>
                {l.precio != null ? (
                  <span className="text-right tabular-nums font-semibold sm:w-28">{mx(precioConIva(l) * l.cantidad)}</span>
                ) : (
                  <input aria-label="Precio con IVA" placeholder="Precio c/IVA" inputMode="decimal" value={l.manual} onChange={(e) => setLineas((ls) => ls.map((x, j) => (j === i ? { ...x, manual: e.target.value } : x)))} className="h-9 w-28 rounded-lg border border-red-300 px-2 text-right" />
                )}
                <button type="button" onClick={() => setLineas((ls) => ls.filter((_, j) => j !== i))} className="text-[13px] text-secundario hover:text-red-700">Quitar</button>
              </li>
            ))}
          </ul>
        )}
        {sinExistencia.length > 0 && <p className="rounded-xl bg-niebla p-3 text-[13px]">Ojo: {sinExistencia.length} producto(s) con más cantidad que la existencia en sistema. Se puede vender; la existencia quedará negativa y aparecerá en Inventario para revisar.</p>}
        <InventarioFocos productos={inventario} categorias={categorias} onAgregar={agregar} />
      </section>

      <aside className="space-y-4 rounded-[20px] bg-white p-4">
        <div className="flex items-baseline justify-between">
          <span className="text-secundario">Total con IVA</span>
          <span className="font-display text-[34px] font-semibold tabular-nums">{mx(total)}</span>
        </div>
        <ClienteVenta cliente={ficha} onCambio={(c) => { setFicha(c); setUsarPuntos(false); if (!c && forma === "credito") setForma("efectivo"); }} />
        {ficha && (
          <button type="button" onClick={async () => {
            const r = await darAccesoCelular(ficha.id);
            if (r.url) setAccesoQr(await QRCode.toString(r.url, { type: "svg", margin: 1 })); else setAvisoQr(r.error ?? "No se pudo.");
          }} className="text-[13px] text-azul underline">Dar acceso a su cuenta en su celular</button>
        )}
        {accesoQr && (
          <div className="fixed inset-0 z-[85] flex flex-col items-center justify-center gap-3 bg-white/95 p-6 text-center" role="dialog" aria-label="Acceso del cliente">
            <p className="text-[18px] font-semibold">Que el cliente escanee esto con la cámara de su celular</p>
            <div className="h-64 w-64 [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: accesoQr }} />
            <p className="max-w-sm text-[14px] text-secundario">Abre su cuenta con sus puntos, pedidos y su código para recomendar. Sirve una sola vez y vence en 10 minutos.</p>
            <button type="button" onClick={() => setAccesoQr(null)} className="rounded-full bg-azul px-6 py-3 font-semibold text-white">Listo</button>
          </div>
        )}
        {ficha && ficha.puntos > 0 && (
          <label className="flex items-center justify-between gap-2 rounded-xl bg-niebla px-3 py-2 text-[14px]">
            <span><input type="checkbox" checked={usarPuntos} onChange={(e) => setUsarPuntos(e.target.checked)} className="mr-2" />Usar {ficha.puntos} puntos</span>
            <strong>− {mx(Math.min(ficha.puntos * ficha.valorPunto, total))}</strong>
          </label>
        )}
        {descuentoPuntos > 0 && <p className="flex justify-between text-[15px] font-semibold"><span>Por cobrar</span><span className="tabular-nums">{mx(porCobrar)}</span></p>}
        <div>
          <p className={etiqueta}>Forma de pago</p>
          <Segmentado name="forma" valor={forma} onCambio={(v) => setForma(v as typeof forma)} opciones={[{ id: "efectivo", texto: "Efectivo" }, { id: "tarjeta", texto: "Tarjeta" }, { id: "transferencia", texto: "Transfer." }, ...(ficha?.credito.activo ? [{ id: "credito", texto: "Crédito" }] : [])]} />
        </div>
        {forma === "efectivo" ? (
          <div>
            <label className={etiqueta} htmlFor="recibido">Recibido</label>
            <input id="recibido" inputMode="decimal" value={recibido} onChange={(e) => setRecibido(e.target.value)} className={campo} />
            {Number(recibido) > 0 && <p className="mt-1 text-[15px]">Cambio: <strong className={cambio < 0 ? "text-red-700" : "text-azul"}>{mx(Math.max(0, cambio))}</strong>{cambio < 0 && " · falta dinero"}</p>}
          </div>
        ) : (
          <div className="space-y-2">
            {forma === "tarjeta" && (terminales.length === 0
              ? <p className="text-[13px] font-semibold text-red-700">Esta caja no tiene terminal asignada; no se puede cobrar con tarjeta.</p>
              : <div>
                  <label className={etiqueta} htmlFor="terminal">Terminal</label>
                  <select id="terminal" value={terminal} onChange={(e) => setTerminal(e.target.value)} className={campo} required>
                    <option value="">¿En qué terminal cobraste?</option>
                    {terminales.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                  </select>
                </div>)}
            {forma === "transferencia" && <p className="text-[13px] text-secundario">La venta queda pendiente de pago hasta que se confirme la transferencia. No se entrega antes.</p>}
            {forma === "credito" && <p className="text-[13px] text-secundario">Se carga a su estado de cuenta. El sistema revisa que no tenga saldo vencido y que quepa en su límite.</p>}
            <div>
              <label className={etiqueta} htmlFor="referencia">{forma === "tarjeta" ? "Autorización de la terminal" : "Referencia"}</label>
              <input id="referencia" value={referencia} onChange={(e) => setReferencia(e.target.value)} className={campo} />
            </div>
          </div>
        )}
        <div>
          <p className={etiqueta}>Comprobante</p>
          <Segmentado name="comprobante" valor={comprobante} onCambio={(v) => setComprobante(v as typeof comprobante)} opciones={[{ id: "nota", texto: "Nota" }, { id: "factura", texto: "Factura" }]} />
        </div>
        <div className="grid gap-2">
          {comprobante === "factura" && !ficha?.rfc && (
            <>
              <input placeholder="RFC" value={cliente.rfc} onChange={(e) => setCliente({ ...cliente, rfc: e.target.value.toUpperCase() })} className={campo} />
              <input placeholder="Razón social" value={cliente.razon} onChange={(e) => setCliente({ ...cliente, razon: e.target.value })} className={campo} />
              <div className="grid grid-cols-2 gap-2">
                <input placeholder="C.P. fiscal" inputMode="numeric" value={cliente.cp} onChange={(e) => setCliente({ ...cliente, cp: e.target.value })} className={campo} />
                <input placeholder="Régimen (ej. 601)" value={cliente.regimen} onChange={(e) => setCliente({ ...cliente, regimen: e.target.value })} className={campo} />
              </div>
              <p className="text-[12px] text-secundario">La factura queda pendiente de timbrar hasta conectar el PAC.</p>
            </>
          )}
        </div>
        {error && <p role="alert" className="font-semibold text-red-700">{error}</p>}
        <button type="button" disabled={enviando || lineas.length === 0} onClick={cobrar} className={clasesBoton("principal", "grande", true)}>
          {enviando ? "Registrando…" : forma === "credito" ? `Cargar a crédito ${mx(porCobrar)}` : `Cobrar ${mx(porCobrar)}`}
        </button>
      </aside>
    </div>
  );
}
