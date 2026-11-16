"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type LineaCarrito = { id: string; sku: string; nombre: string; unidad: string; cantidad: number };

type Ctx = {
  lineas: LineaCarrito[];
  piezas: number;
  agregar: (l: Omit<LineaCarrito, "cantidad">, cantidad?: number) => void;
  cambiar: (id: string, cantidad: number) => void;
  vaciar: () => void;
};

const CarritoCtx = createContext<Ctx | null>(null);
const CLAVE = "tuval.carrito.v1";

export function CarritoProvider({ children }: { children: React.ReactNode }) {
  const [lineas, setLineas] = useState<LineaCarrito[]>([]);
  const [cargado, setCargado] = useState(false);

  useEffect(() => {
    try {
      const guardado = localStorage.getItem(CLAVE);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hidratar desde almacenamiento local
      if (guardado) setLineas(JSON.parse(guardado));
    } catch {}
    setCargado(true);
  }, []);

  useEffect(() => {
    if (!cargado) return;
    try {
      localStorage.setItem(CLAVE, JSON.stringify(lineas));
    } catch {}
  }, [lineas, cargado]);

  const agregar = useCallback<Ctx["agregar"]>((l, cantidad = 1) => {
    setLineas((prev) => {
      const existe = prev.find((x) => x.id === l.id);
      if (existe) return prev.map((x) => (x.id === l.id ? { ...x, cantidad: x.cantidad + cantidad } : x));
      return [...prev, { ...l, cantidad }];
    });
  }, []);

  const cambiar = useCallback((id: string, cantidad: number) => {
    setLineas((prev) =>
      cantidad <= 0 ? prev.filter((x) => x.id !== id) : prev.map((x) => (x.id === id ? { ...x, cantidad } : x)),
    );
  }, []);

  const vaciar = useCallback(() => setLineas([]), []);

  const valor = useMemo(
    () => ({ lineas, piezas: lineas.reduce((s, l) => s + l.cantidad, 0), agregar, cambiar, vaciar }),
    [lineas, agregar, cambiar, vaciar],
  );
  return <CarritoCtx.Provider value={valor}>{children}</CarritoCtx.Provider>;
}

export function useCarrito() {
  const c = useContext(CarritoCtx);
  if (!c) throw new Error("useCarrito fuera de CarritoProvider");
  return c;
}
