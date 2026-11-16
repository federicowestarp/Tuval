import { ImageResponse } from "next/og";

export const alt = "Tuval · Tubería, equipos y eléctrico. Todo, a tiempo.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Vista previa al compartir la liga (WhatsApp, redes): fondo piedra, símbolo y eslogan. */
export default function Imagen() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: 90, background: "#F4F2EE" }}>
        <svg width="120" height="120" viewBox="0 0 64 64">
          <path d="M53.00 32.00 A21 21 0 1 1 37.44 11.72" fill="none" stroke="#0B2E5C" strokeWidth="11" strokeLinecap="round" />
          <circle cx="37.44" cy="11.72" r="6.49" fill="#2BB3D9" />
        </svg>
        <div style={{ marginTop: 40, fontSize: 76, fontWeight: 700, color: "#1D1D1F", letterSpacing: -3, lineHeight: 1.05 }}>Tubería, equipos y eléctrico.</div>
        <div style={{ fontSize: 76, fontWeight: 700, color: "#6E6E73", letterSpacing: -3, lineHeight: 1.05 }}>Todo, a tiempo.</div>
        <div style={{ marginTop: 36, fontSize: 30, color: "#6E6E73" }}>Puebla · Atlixco · Tlaxcala · tuval.mx</div>
      </div>
    ),
    size,
  );
}
