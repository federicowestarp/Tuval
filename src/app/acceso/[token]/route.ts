import { NextResponse } from "next/server";
import { abrirSesionDeCuenta, canjearAcceso } from "@/lib/sesion";

/** QR que el cajero le muestra al cliente: abre su cuenta (puntos, pedidos, código) en su celular. Un solo uso, 10 minutos. */
export async function GET(req: Request, ctx: RouteContext<"/acceso/[token]">) {
  const { token } = await ctx.params;
  const cuenta = /^[A-Za-z0-9_-]{20,60}$/.test(token) ? await canjearAcceso(token) : null;
  if (!cuenta) return NextResponse.redirect(new URL("/cuenta?acceso=vencido", req.url));
  await abrirSesionDeCuenta(cuenta);
  return NextResponse.redirect(new URL("/cuenta?acceso=ok", req.url));
}
