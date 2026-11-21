import type { Metadata, Viewport } from "next";
import { Inter, Inter_Tight } from "next/font/google";
import "./globals.css";
import { URL_SITIO } from "@/lib/sitio";
import { CarritoProvider } from "@/components/carrito/CarritoProvider";
import { Arranque } from "@/components/Arranque";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const interTight = Inter_Tight({ variable: "--font-inter-tight", subsets: ["latin"], weight: ["500", "600"] });

export const metadata: Metadata = {
  metadataBase: new URL(URL_SITIO),
  title: { default: "Tuval · Tubería, equipos y eléctrico. Todo, a tiempo.", template: "%s · Tuval" },
  description: "Tubería, conexiones, válvulas, equipos y material eléctrico, entregados en tu obra. Pide con tu lista o foto; si no lo tenemos, lo conseguimos.",
  applicationName: "Tuval",
  openGraph: { type: "website", locale: "es_MX", siteName: "Tuval" },
  appleWebApp: { capable: true, title: "Tuval", statusBarStyle: "default" },
};

export const viewport: Viewport = { themeColor: "#ffffff" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es-MX"
      className={`${inter.variable} ${interTight.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        {/* Si ya se vio la animación de arranque en esta sesión, no se vuelve a mostrar (antes de pintar, para que no aparezca a medias). */}
        <script dangerouslySetInnerHTML={{ __html: "try{if(sessionStorage.getItem('tuval.arranque')==='1')document.documentElement.classList.add('arranque-visto')}catch(e){}" }} />
        <Arranque />
        <CarritoProvider>{children}</CarritoProvider>
      </body>
    </html>
  );
}
