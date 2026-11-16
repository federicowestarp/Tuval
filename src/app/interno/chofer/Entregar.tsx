"use client";

import { useActionState, useRef, useState } from "react";
import { campo, clasesBoton, etiqueta } from "@/components/ui";
import { IconoCamara } from "@/components/Iconos";
import { entregar, type EstadoEntrega } from "./acciones";

/** Reduce la foto en el teléfono (máx. 1600 px). */
async function reducir(f: File): Promise<File> {
  try {
    const bmp = await createImageBitmap(f);
    const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * k);
    c.height = Math.round(bmp.height * k);
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
    const b = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", 0.8));
    return b ? new File([b], "entrega.jpg", { type: "image/jpeg" }) : f;
  } catch {
    return f;
  }
}

export function Entregar({ pedidoId, permiteSinRecepcion, recibeNombre }: { pedidoId: string; permiteSinRecepcion: boolean; recibeNombre: string | null }) {
  const [e, accion, enviando] = useActionState<EstadoEntrega, FormData>(entregar, {});
  const [abierto, setAbierto] = useState(false);
  const [fotos, setFotos] = useState<{ f: File; url: string }[]>([]);
  const [sinRecepcion, setSinRecepcion] = useState(false);
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const pedirUbicacion = () =>
    navigator.geolocation?.getCurrentPosition(
      (p) => setPos({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => {},
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60_000 },
    );

  if (e.ok) return <p className="rounded-[20px] bg-piedra p-4 font-semibold">Entregado ✓</p>;
  if (!abierto) return <button onClick={() => { setAbierto(true); pedirUbicacion(); }} className={clasesBoton("principal", "grande", true)}>Entregar</button>;

  const enviar = (fd: FormData) => {
    fd.delete("fotos");
    fotos.forEach((x) => fd.append("fotos", x.f));
    if (pos) { fd.set("lat", String(pos.lat)); fd.set("lng", String(pos.lng)); }
    accion(fd);
  };

  return (
    <form action={enviar} className="aparecer space-y-4 rounded-[20px] bg-niebla p-4">
      <input type="hidden" name="pedido_id" value={pedidoId} />
      <div>
        <span className={etiqueta}>Fotos de la entrega</span>
        <div className="flex flex-wrap gap-2">
          {fotos.map((x) => (
            // eslint-disable-next-line @next/next/no-img-element -- vista previa local
            <img key={x.url} src={x.url} alt="" className="h-20 w-20 rounded-xl object-cover" />
          ))}
          {fotos.length < 4 && (
            <button type="button" onClick={() => input.current?.click()} className="flex h-20 w-20 items-center justify-center rounded-xl bg-white text-azul ring-1 ring-linea" aria-label="Tomar foto">
              <IconoCamara className="h-7 w-7" />
            </button>
          )}
        </div>
        <input
          ref={input} type="file" accept="image/*" capture="environment" className="sr-only"
          onChange={async (ev) => {
            const f = ev.target.files?.[0];
            ev.target.value = "";
            if (!f) return;
            const r = await reducir(f);
            setFotos((xs) => [...xs, { f: r, url: URL.createObjectURL(r) }]);
          }}
        />
        <p className="mt-1.5 text-[13px] text-secundario">Que se vea el material y el lugar. {pos ? "Ubicación capturada ✓" : "Capturando ubicación…"}</p>
      </div>
      {permiteSinRecepcion && (
        <label className="flex items-center gap-3 text-[15px]">
          <input type="checkbox" name="sin_recepcion" checked={sinRecepcion} onChange={(x) => setSinRecepcion(x.target.checked)} className="h-5 w-5" />
          Nadie recibió (autorizado por el cliente)
        </label>
      )}
      {!sinRecepcion && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={etiqueta} htmlFor={`recibio-${pedidoId}`}>Recibió</label>
            <input id={`recibio-${pedidoId}`} name="recibio" defaultValue={recibeNombre ?? ""} className={campo} />
          </div>
          <div>
            <label className={etiqueta} htmlFor={`tel-${pedidoId}`}>Teléfono (opcional)</label>
            <input id={`tel-${pedidoId}`} name="recibio_telefono" inputMode="tel" className={campo} />
          </div>
        </div>
      )}
      <input name="notas" placeholder="Notas (opcional)" className={campo} />
      {e.error && <p role="alert" className="font-semibold text-red-700">{e.error}</p>}
      <button disabled={enviando || fotos.length === 0} className={clasesBoton("principal", "grande", true)}>
        {enviando ? "Guardando…" : fotos.length === 0 ? "Toma al menos una foto" : "Confirmar entrega"}
      </button>
    </form>
  );
}
