/**
 * Logo Tuval v2 (kit de marca): anillo de avance + nombre en trazos.
 * Fuente de verdad: public/marca/*.svg. No deformar, rotar ni recolorear.
 */
const ANILLO = "M53.00 32.00 A21 21 0 1 1 37.44 11.72";
const LETRAS = [
  ["translate(116.00 86.00) scale(0.04832 -0.04832)", "M43 1264V1490H1231V1264H771V0H504V1264Z"],
  ["translate(175.09 86.00) scale(0.04832 -0.04832)", "M809 469V1118H1072V0H817V199H805Q767 105 681.0 45.0Q595 -15 469 -14Q359 -14 275.5 34.5Q192 83 144.5 177.5Q97 272 97 406V1118H360V446Q360 341 418.5 278.0Q477 215 572 216Q630 216 684.5 244.0Q739 272 774.0 328.0Q809 384 809 469Z"],
  ["translate(229.10 86.00) scale(0.04832 -0.04832)", "M1095 1118 697 0H405L8 1118H289L548 287H560L817 1118Z"],
  ["translate(279.93 86.00) scale(0.04832 -0.04832)", "M419 -23Q312 -23 227.0 15.5Q142 54 93.0 129.0Q44 204 44 314Q44 408 79.0 470.0Q114 532 174.5 569.0Q235 606 311.0 625.5Q387 645 468 653Q567 664 628.0 672.0Q689 680 716.5 698.0Q744 716 744 754V759Q744 840 696.0 885.0Q648 930 556 930Q459 930 402.5 888.0Q346 846 326 789L81 824Q110 926 177.0 994.5Q244 1063 340.5 1097.5Q437 1132 554 1132Q634 1132 714.0 1113.5Q794 1095 861.0 1051.0Q928 1007 968.0 933.0Q1008 859 1008 748V0H755V154H747Q723 108 679.5 67.5Q636 27 571.5 2.0Q507 -23 419 -23ZM486 171Q566 171 624.0 202.5Q682 234 714.0 286.5Q746 339 746 401V532Q733 522 704.0 513.5Q675 505 638.0 498.0Q601 491 565.5 486.0Q530 481 504 478Q445 470 398.5 451.5Q352 433 325.0 401.0Q298 369 298 318Q298 245 351.0 208.0Q404 171 486 171Z"],
  ["translate(330.90 86.00) scale(0.04832 -0.04832)", "M360 1490V0H97V1490Z"],
] as const;

const AZUL = "#0B2E5C", CIAN = "#2BB3D9", TINTA = "#1D1D1F", BLANCO = "#FFFFFF";

export function Simbolo({ className = "h-8 w-8", tono = "color" }: { className?: string; tono?: "color" | "negativo" }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <path d={ANILLO} fill="none" stroke={tono === "negativo" ? BLANCO : AZUL} strokeWidth="11" strokeLinecap="round" />
      <circle cx="37.44" cy="11.72" r="6.49" fill={CIAN} />
    </svg>
  );
}

/** Logo horizontal. "color": uso principal · "negativo": sobre azul. Mínimo 24 px de alto. */
export function Logo({ tono = "color", className = "h-7 w-auto" }: { tono?: "color" | "negativo"; className?: string }) {
  const anillo = tono === "negativo" ? BLANCO : AZUL;
  const texto = tono === "negativo" ? BLANCO : TINTA;
  return (
    <svg viewBox="0 0 353 100" className={className} role="img" aria-label="Tuval">
      <g transform="translate(0.0 4.0) scale(1.4375)">
        <path d={ANILLO} fill="none" stroke={anillo} strokeWidth="11" strokeLinecap="round" />
        <circle cx="37.44" cy="11.72" r="6.49" fill={CIAN} />
      </g>
      {LETRAS.map(([t, d]) => <path key={t} transform={t} d={d} fill={texto} />)}
    </svg>
  );
}

/**
 * Aparición del logo (arranque): el anillo se traza en 700 ms, aparece el punto cian (300 ms) y entran las letras
 * una por una (400 ms, 60 ms de diferencia). El anillo se dibuja centrado y se recorre a su lugar cuando entra el nombre. Después el punto late mientras termina de cargar. Solo CSS.
 */
export function LogoAnimado({ className = "h-16 w-auto" }: { className?: string }) {
  return (
    <svg viewBox="0 0 353 100" className={className} role="img" aria-label="Tuval">
      <g className="logo-anillo">
      <g transform="translate(0.0 4.0) scale(1.4375)">
        <circle className="logo-trazo" cx="32" cy="32" r="21" fill="none" stroke={AZUL} strokeWidth="11" strokeLinecap="round" strokeDasharray="104.46 200" />
        <circle className="logo-punto" cx="37.44" cy="11.72" r="6.5" fill={CIAN} />
      </g>
      </g>
      {LETRAS.map(([t, d], i) => (
        <g key={t} className="logo-letra" style={{ animationDelay: `${850 + i * 60}ms` }}>
          <path transform={t} d={d} fill={TINTA} />
        </g>
      ))}
    </svg>
  );
}
