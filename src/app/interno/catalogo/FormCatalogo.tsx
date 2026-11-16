"use client";

import { startTransition, useActionState, useRef, useState } from "react";
import { clasesBoton, campo, etiqueta } from "@/components/ui";
import { CATEGORIAS } from "@/lib/categorias";
import { formatoMoneda } from "@/lib/catalogo-formato";
import { importarCatalogo, revisarCatalogo, type ResultadoImportacion } from "./acciones";

const nombreCat = (id: string) => CATEGORIAS.find((c) => c.id === id)?.nombre ?? "Por clasificar";

export function FormCatalogo() {
  const [vista, revisar, revisando] = useActionState<ResultadoImportacion, FormData>(revisarCatalogo, {});
  const [res, importar, importando] = useActionState<ResultadoImportacion, FormData>(importarCatalogo, {});
  const form = useRef<HTMLFormElement>(null);
  // El archivo se guarda aparte: React limpia el formulario después de cada acción.
  const [archivo, setArchivo] = useState<File | null>(null);
  const enviar = (accion: (fd: FormData) => void) => {
    const fd = new FormData(form.current!);
    if (archivo) fd.set("archivo", archivo);
    startTransition(() => accion(fd));
  };

  return (
    <form ref={form} onSubmit={(e) => e.preventDefault()} className="space-y-4">
      <div>
        <label className={etiqueta} htmlFor="archivo">Archivo CSV</label>
        <input id="archivo" type="file" accept=".csv,text/csv" onChange={(e) => setArchivo(e.target.files?.[0] ?? null)} className="block w-full text-sm" />
        {archivo && <p className="mt-1 text-[13px]">Archivo: {archivo.name}</p>}
        <p className="mt-1.5 text-[13px] text-secundario">Columnas reconocidas: sku/código, nombre, categoría, unidad, marca, modelo, proveedor, costo, precio, existencia.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={etiqueta} htmlFor="origen">Origen</label>
          <input id="origen" name="origen" defaultValue="puraqua-prueba" className={campo} />
        </div>
        <div>
          <label className={etiqueta} htmlFor="almacen">Existencias en el almacén</label>
          <input id="almacen" name="almacen" defaultValue="PurAqua (prueba)" className={campo} />
        </div>
      </div>
      <button type="button" onClick={() => enviar(revisar)} disabled={revisando || !archivo} className={clasesBoton("secundario", "normal")}>{revisando ? "Revisando…" : "Revisar sin guardar"}</button>

      {vista.error && <p role="alert" className="font-semibold text-red-700">{vista.error}</p>}
      {vista.vista && (
        <div className="aparecer space-y-3 rounded-[20px] bg-niebla p-4">
          <p className="font-semibold">{vista.vista.total} productos · {vista.vista.conPrecio} con precio</p>
          <div className="flex flex-wrap gap-2 text-[13px]">
            {Object.entries(vista.vista.porCategoria).sort((a, b) => b[1] - a[1]).map(([c, n]) => (
              <span key={c} className="rounded-full bg-white px-3 py-1">{nombreCat(c)}: {n}</span>
            ))}
          </div>
          <ul className="divide-y divide-linea text-[14px]">
            {vista.vista.ejemplos.map((p) => (
              <li key={p.sku} className="flex justify-between gap-3 py-2">
                <span>{p.nombre} <span className="text-secundario">· {nombreCat(p.categoria)} · {p.sku}</span></span>
                <span className="shrink-0">{p.precio != null ? formatoMoneda(p.precio) : "sin precio"}</span>
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => enviar(importar)} disabled={importando || !archivo} className={clasesBoton("principal", "normal")}>
            {importando ? "Importando…" : `Importar ${vista.vista.total} productos`}
          </button>
        </div>
      )}
      {res.error && <p role="alert" className="font-semibold text-red-700">{res.error}</p>}
      {res.importados != null && <p className="aparecer rounded-[20px] bg-piedra p-4 font-semibold">Listo: {res.importados} productos importados. Ya aparecen en la tienda.</p>}
    </form>
  );
}
