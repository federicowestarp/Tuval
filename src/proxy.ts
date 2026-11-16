import { NextResponse, type NextRequest } from "next/server";

/**
 * Filtro rápido del panel interno: sin cookie de sesión, directo a la entrada.
 * La validación real (sesión vigente, usuario activo, rol) se hace en el servidor con requerirInterno().
 */
export function proxy(req: NextRequest) {
  if (!req.cookies.get("tuval_interno")) {
    const url = new URL("/interno/entrar", req.url);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/interno/((?!entrar|activar).*)", "/interno"],
};
