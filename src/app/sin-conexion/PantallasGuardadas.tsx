"use client";

import { useEffect, useState } from "react";

const NOMBRES: [RegExp, string][] = [
  [/^\/$/, "Inicio"], [/^\/tienda/, "Tienda"], [/^\/carrito/, "Carrito"], [/^\/lista/, "Pedir con lista"], [/^\/donde/, "¿Dónde está?"],
  [/^\/cuenta\/pedidos/, "Mis pedidos"], [/^\/cuenta/, "Mi cuenta"], [/^\/pedido\//, "Pedido"], [/^\/producto\//, "Producto"],
  [/^\/interno\/chofer/, "Ruta de hoy"], [/^\/interno\/pedidos\/./, "Pedido (panel)"], [/^\/interno\/pedidos/, "Pedidos"],
  [/^\/interno\/mostrador/, "Mostrador"], [/^\/interno\/caja/, "Caja"], [/^\/interno\/vender/, "Vender"], [/^\/interno\/recorrido/, "Recorrido de tienda"],
  [/^\/interno\/chequeo/, "Chequeo de anaquel"], [/^\/interno\/surtido/, "Surtido"], [/^\/interno\/plano/, "Plano"],
  [/^\/interno\/inventario-fisico/, "Inventario físico"], [/^\/interno\/inventario/, "Inventario"], [/^\/interno\/demanda/, "Demanda"],
  [/^\/interno\/rutas/, "Rutas"], [/^\/interno\/tablero/, "Tablero"],
];
const nombre = (p: string) => NOMBRES.find(([r]) => r.test(p))?.[1] ?? p;

export function PantallasGuardadas() {
  const [lista, setLista] = useState<{ url: string; nombre: string }[] | null>(null);
  useEffect(() => {
    (async () => {
      try {
        const c = await caches.open("tuval-paginas-v1");
        const urls = (await c.keys()).map((r) => new URL(r.url).pathname + new URL(r.url).search).filter((u) => u !== "/sin-conexion");
        setLista(urls.map((url) => ({ url, nombre: nombre(url.split("?")[0]) })).sort((a, b) => a.url.localeCompare(b.url)));
      } catch { setLista([]); }
    })();
  }, []);
  if (!lista) return null;
  if (lista.length === 0) return <p className="rounded-[20px] bg-niebla p-4 text-[15px]">Todavía no hay pantallas guardadas. Abre la app con señal una vez y se guardan solas.</p>;
  return (
    <ul className="divide-y divide-linea rounded-[20px] bg-niebla px-4">
      {lista.map((x) => (
        <li key={x.url}>
          {/* Liga normal (no de Next): sin señal, el service worker entrega la copia guardada. */}
          <a href={x.url} className="flex min-h-11 items-center justify-between gap-3 py-3 text-[15px]">
            <span className="font-semibold">{x.nombre}</span>
            <span className="truncate text-[13px] text-secundario">{x.url.length > 28 ? "…" + x.url.slice(-20) : x.url}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}
