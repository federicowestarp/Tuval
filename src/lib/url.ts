import { headers } from "next/headers";

/** Dominio público para ligas que se comparten (WhatsApp). URL_PUBLICA manda si está definida. */
export async function urlBase(): Promise<string> {
  if (process.env.URL_PUBLICA) return process.env.URL_PUBLICA.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
