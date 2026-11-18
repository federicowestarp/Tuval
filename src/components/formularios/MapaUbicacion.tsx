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
      // Pin con el símbolo de Tuval (anillo abierto + punto cian), apoyado en la punta.
      const icono = L.divIcon({
        className: "pin-tuval",
        html: `<svg width="40" height="50" viewBox="0 0 40 50" aria-hidden="true">
          <path d="M20 49c-1.2-6.5-16-17.5-16-29a16 16 0 0 1 32 0c0 11.5-14.8 22.5-16 29z" fill="#0b2e5c" stroke="#fff" stroke-width="2.5"/>
          <path d="M28.5 20a8.5 8.5 0 1 1-2.5-6" fill="none" stroke="#fff" stroke-width="3.6" stroke-linecap="round"/>
          <circle cx="26.6" cy="12.6" r="2.6" fill="#2bb3d9"/>
        </svg>`,
        iconSize: [40, 50],
        iconAnchor: [20, 49],
      });
      const inicio = pos ?? PUEBLA;
      mapa = L.map(div.current, { zoomControl: false, attributionControl: true }).setView(inicio, pos ? 17 : 12);
      L.control.zoom({ position: "bottomright", zoomInTitle: "Acercar", zoomOutTitle: "Alejar" }).addTo(mapa);
      mapa.attributionControl.setPrefix(false);
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
      <div ref={div} className="mapa-tuval h-64 w-full overflow-hidden rounded-[20px] bg-[#E8F1FB] ring-1 ring-[#C9D6E8]" />
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
