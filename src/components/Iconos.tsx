/** Íconos de línea (trazo redondeado, como los de categoría del manual). */
type P = { className?: string };
const base = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;
const I = ({ className = "h-6 w-6", children }: P & { children: React.ReactNode }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true"><g {...base}>{children}</g></svg>
);

export const IconoBuscar = (p: P) => <I {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></I>;
export const IconoCamara = (p: P) => <I {...p}><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></I>;
export const IconoBolsa = (p: P) => <I {...p}><path d="M5 8h14l-1 12H6z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></I>;
export const IconoInicio = (p: P) => <I {...p}><path d="M4 11 12 4l8 7v9h-5v-6H9v6H4z" /></I>;
export const IconoTienda = (p: P) => <I {...p}><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><rect x="13" y="13" width="7" height="7" rx="1.5" /></I>;
export const IconoCaja = (p: P) => <I {...p}><path d="m4 8 8-4 8 4v8l-8 4-8-4z" /><path d="m4 8 8 4 8-4M12 12v8" /></I>;
export const IconoPersona = (p: P) => <I {...p}><circle cx="12" cy="8" r="4" /><path d="M4 20c1.5-4 4.5-6 8-6s6.5 2 8 6" /></I>;
export const IconoLista = (p: P) => <I {...p}><path d="M9 6h11M9 12h11M9 18h11" /><circle cx="4.5" cy="6" r=".5" /><circle cx="4.5" cy="12" r=".5" /><circle cx="4.5" cy="18" r=".5" /></I>;
export const IconoFlecha = (p: P) => <I {...p}><path d="m9 5 7 7-7 7" /></I>;
export const IconoAtras = (p: P) => <I {...p}><path d="m15 5-7 7 7 7" /></I>;
export const IconoCheck = (p: P) => <I {...p}><path d="m5 12 4.5 4.5L19 7" /></I>;
export const IconoMas = (p: P) => <I {...p}><path d="M12 5v14M5 12h14" /></I>;
export const IconoMenos = (p: P) => <I {...p}><path d="M5 12h14" /></I>;
export const IconoChat = (p: P) => <I {...p}><path d="M4 20l1.5-4A8 8 0 1 1 9 19.2z" /></I>;
export const IconoCamion = (p: P) => <I {...p}><path d="M3 6h11v10H3zM14 9h4l3 3v4h-7" /><circle cx="7" cy="17.5" r="1.8" /><circle cx="17" cy="17.5" r="1.8" /></I>;
export const IconoPin = (p: P) => <I {...p}><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" /></I>;
export const IconoDocumento = (p: P) => <I {...p}><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4M9 12h6M9 16h6" /></I>;
export const IconoCerrar = (p: P) => <I {...p}><path d="M6 6l12 12M18 6 6 18" /></I>;
