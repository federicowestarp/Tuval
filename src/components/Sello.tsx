const estilos = {
  "Disponible hoy": "bg-cian text-profundo",
  "Te lo mandamos hoy": "bg-azul text-white",
  "Entrega programada": "border-2 border-azul text-azul bg-white",
  "Pídelo en Tuval": "bg-profundo text-white",
} as const;

export type TipoSello = keyof typeof estilos;

export function Sello({ tipo }: { tipo: TipoSello }) {
  return (
    <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${estilos[tipo]}`}>
      {tipo}
    </span>
  );
}
