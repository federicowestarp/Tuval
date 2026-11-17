"use client";

import { useEffect } from "react";

export function Imprimir() {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 300);
    return () => clearTimeout(t);
  }, []);
  return (
    <button onClick={() => window.print()} className="mt-4 w-full rounded border border-black py-2 print:hidden">Imprimir</button>
  );
}
