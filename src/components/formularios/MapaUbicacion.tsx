"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";

/** Centro por defecto: Puebla (zócalo). El cliente mueve el pin o usa su ubicación. */
const PUEBLA: [number, number] = [19.0433, -98.1981];

export function MapaUbicacion({ lat, lng }: { lat?: number; lng?: number }) {
  const div = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<[number, number] | null>(lat != null && lng != null ? [lat, lng] : null);
  const [aviso, setAviso] = useState("");
  const mapaRef = useRef<{ mover: (p: [number, number]) => void } | null>(null);
  // Ubicación obtenida antes de que el mapa termine de cargar (señal lenta): se aplica al estar listo.
  const pendiente = useRef<[number, number] | null>(null);

  useEffect(() => {
    let mapa: import("leaflet").Map | undefined;
    let cancelado = false;
    (async () => {
      const L = await import("leaflet");
      if (cancelado || !div.current) return;
      const icono = L.divIcon({
        className: "",
        html: '<div style="width:22px;height:22px;border-radius:50%;background:#2bb3d9;border:4px solid #0b2e5c;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>',
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });
      const inicio = pos ?? PUEBLA;
      mapa = L.map(div.current).setView(inicio, pos ? 17 : 12);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "© OpenStreetMap",
      }).addTo(mapa);
      let marcador = pos ? L.marker(pos, { icon: icono, draggable: true }).addTo(mapa) : null;
      const mover = (p: [number, number]) => {
        if (!mapa) return;
        if (!marcador) {
          marcador = L.marker(p, { icon: icono, draggable: true }).addTo(mapa);
          marcador.on("dragend", () => {
            const ll = marcador!.getLatLng();
            setPos([ll.lat, ll.lng]);
          });
        } else marcador.setLatLng(p);
        setPos(p);
      };
      marcador?.on("dragend", () => {
        const ll = marcador!.getLatLng();
        setPos([ll.lat, ll.lng]);
      });
      mapa.on("click", (e) => mover([e.latlng.lat, e.latlng.lng]));
      mapaRef.current = {
        mover: (p) => {
          mover(p);
          mapa?.setView(p, 17);
        },
      };
      if (pendiente.current) mapaRef.current.mover(pendiente.current);
    })();
    return () => {
      cancelado = true;
      mapa?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- el mapa se crea una sola vez
  }, []);

  const usarMiUbicacion = () => {
    if (!navigator.geolocation) return setAviso("Tu navegador no permite obtener la ubicación.");
    setAviso("Buscando tu ubicación…");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const punto: [number, number] = [p.coords.latitude, p.coords.longitude];
        if (mapaRef.current) mapaRef.current.mover(punto);
        else {
          pendiente.current = punto;
          setPos(punto);
        }
        setAviso("");
      },
      () => setAviso("No pudimos obtener tu ubicación. Toca el mapa para marcarla."),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  return (
    <div>
      <div ref={div} className="h-64 w-full overflow-hidden rounded-[20px] bg-niebla" />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button type="button" onClick={usarMiUbicacion} className="inline-flex h-10 items-center rounded-full bg-niebla px-4 text-[14px] font-semibold text-azul">
          Usar mi ubicación actual
        </button>
        <span className="text-[13px] text-secundario">{aviso || (pos ? "Ubicación marcada. Puedes mover el punto." : "Toca el mapa para marcar la entrada.")}</span>
      </div>
      <input type="hidden" name="lat" value={pos?.[0] ?? ""} />
      <input type="hidden" name="lng" value={pos?.[1] ?? ""} />
    </div>
  );
}
