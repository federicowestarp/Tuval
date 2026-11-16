"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

/** Producto del catálogo o algo que el cliente pidió y no está en catálogo (especial). */
export type LineaCarrito = {
  id: string; // id de producto, o "esp-…" si es especial
  sku: string;
  nombre: string;
  unidad: string;
  cantidad: number;
  especial?: boolean;
};
export type Adjunto = { id: string; nombre: string };

type Ctx = {
  lineas: LineaCarrito[];
  adjuntos: Adjunto[];
  piezas: number;
  agregar: (l: Omit<LineaCarrito, "cantidad">, cantidad?: number) => void;
  agregarEspecial: (descripcion: string, cantidad: number) => void;
  agregarAdjunto: (a: Adjunto) => void;
  quitarAdjunto: (id: string) => void;
  cambiar: (id: string, cantidad: number) => void;
  vaciar: () => void;
};

const CarritoCtx = createContext<Ctx | null>(null);
const CLAVE = "tuval.carrito.v2";

export function CarritoProvider({ children }: { children: React.ReactNode }) {
  const [lineas, setLineas] = useState<LineaCarrito[]>([]);
  const [adjuntos, setAdjuntos] = useState<Adjunto[]>([]);
  const [cargado, setCargado] = useState(false);

  useEffect(() => {
    try {
      const g = JSON.parse(localStorage.getItem(CLAVE) ?? "null");
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hidratar desde almacenamiento local
      if (g?.lineas) setLineas(g.lineas);
      if (g?.adjuntos) setAdjuntos(g.adjuntos);
    } catch {}
    setCargado(true);
  }, []);

  useEffect(() => {
    if (!cargado) return;
    try {
      localStorage.setItem(CLAVE, JSON.stringify({ lineas, adjuntos }));
    } catch {}
  }, [lineas, adjuntos, cargado]);

  const agregar = useCallback<Ctx["agregar"]>((l, cantidad = 1) => {
    setLineas((prev) => {
      const existe = prev.find((x) => x.id === l.id);
      if (existe) return prev.map((x) => (x.id === l.id ? { ...x, cantidad: x.cantidad + cantidad } : x));
      return [...prev, { ...l, cantidad }];
    });
  }, []);

  const agregarEspecial = useCallback((descripcion: string, cantidad: number) => {
    const id = `esp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    setLineas((prev) => [...prev, { id, sku: "", nombre: descripcion, unidad: "", cantidad, especial: true }]);
  }, []);

  const cambiar = useCallback((id: string, cantidad: number) => {
    setLineas((prev) =>
      cantidad <= 0 ? prev.filter((x) => x.id !== id) : prev.map((x) => (x.id === id ? { ...x, cantidad } : x)),
    );
  }, []);

  const agregarAdjunto = useCallback((a: Adjunto) => setAdjuntos((p) => [...p, a]), []);
  const quitarAdjunto = useCallback((id: string) => setAdjuntos((p) => p.filter((a) => a.id !== id)), []);
  const vaciar = useCallback(() => {
    setLineas([]);
    setAdjuntos([]);
  }, []);

  const valor = useMemo(
    () => ({
      lineas, adjuntos, piezas: lineas.reduce((s, l) => s + l.cantidad, 0) + adjuntos.length,
      agregar, agregarEspecial, agregarAdjunto, quitarAdjunto, cambiar, vaciar,
    }),
    [lineas, adjuntos, agregar, agregarEspecial, agregarAdjunto, quitarAdjunto, cambiar, vaciar],
  );
  return <CarritoCtx.Provider value={valor}>{children}</CarritoCtx.Provider>;
}

export function useCarrito() {
  const c = useContext(CarritoCtx);
  if (!c) throw new Error("useCarrito fuera de CarritoProvider");
  return c;
}
