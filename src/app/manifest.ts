import type { MetadataRoute } from "next";

/** Instalable como app en el celular ("Agregar a pantalla de inicio"). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Tuval",
    short_name: "Tuval",
    description: "Tubería, equipos y eléctrico. Todo, a tiempo.",
    start_url: "/",
    display: "standalone",
    background_color: "#FFFFFF",
    theme_color: "#FFFFFF",
    lang: "es-MX",
    icons: [{ src: "/marca/tuval-icono-app.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
