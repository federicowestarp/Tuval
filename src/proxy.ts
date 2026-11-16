import { NextResponse, type NextRequest } from "next/server";

/**
 * 1. admin.tuval.mx (o cualquier host que empiece con "admin.") muestra solo el panel interno:
 *    "/" → /interno/pedidos; las páginas públicas se mandan al sitio principal.
 * 2. Panel interno sin cookie de sesión → a la entrada. La validación real (sesión vigente,
 *    usuario activo, rol) se hace en el servidor con requerirInterno().
 */
const SITIO = process.env.URL_PUBLICA?.replace(/\/$/, "") ?? "https://www.tuval.mx";
const PANEL_LIBRE = /^\/interno\/(entrar|activar)(\/|$)/;

export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const host = req.headers.get("host") ?? "";

  if (host.startsWith("admin.")) {
    if (pathname === "/") return NextResponse.redirect(new URL("/interno/pedidos", req.url));
    const delPanel = pathname.startsWith("/interno") || pathname.startsWith("/archivos/");
    if (!delPanel) return NextResponse.redirect(`${SITIO}${pathname}${search}`);
  }

  if (pathname.startsWith("/interno") && !PANEL_LIBRE.test(pathname) && !req.cookies.get("tuval_interno")) {
    return NextResponse.redirect(new URL("/interno/entrar", req.url));
  }
  return NextResponse.next();
}

export const config = {
  // Todo excepto archivos estáticos (_next, imágenes, íconos, sitemap…).
  matcher: ["/((?!_next/static|_next/image|.*\\..*).*)"],
};
