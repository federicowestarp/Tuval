import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { CarritoProvider } from "@/components/carrito/CarritoProvider";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Tuval · Tubería, equipos y eléctrico",
  description: "Tubería, equipos y eléctrico. Todo, a tiempo.",
};

export const viewport: Viewport = { themeColor: "#0b2e5c" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es-MX"
      className={`${inter.variable} ${spaceGrotesk.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <CarritoProvider>{children}</CarritoProvider>
      </body>
    </html>
  );
}
