"use client";

import { useEffect } from "react";
import { useCarrito } from "./CarritoProvider";

/** Vacía el carrito al llegar a la confirmación de un pedido nuevo. */
export function VaciarCarrito() {
  const { vaciar } = useCarrito();
  useEffect(() => vaciar(), [vaciar]);
  return null;
}
