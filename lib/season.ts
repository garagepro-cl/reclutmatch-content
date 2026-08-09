/**
 * Contexto estacional de Chile para el generador de ideas: el contenido
 * de reclutamiento cambia con el calendario laboral (marzo = peak de
 * contratación post-verano, fin de año = refuerzos y planificación).
 */

interface SeasonInfo {
  name: string;
  angles: string[];
}

const SEASONS: Record<string, SeasonInfo> = {
  verano: {
    name: "verano",
    angles: [
      "planificación de dotación para marzo (el peak de contratación se prepara ahora)",
      "contrataciones de temporada y su riesgo de rotación",
      "evaluar candidatos mientras la competencia está de vacaciones",
      "balance del año: qué contrataciones funcionaron y por qué",
    ],
  },
  otono: {
    name: "otoño",
    angles: [
      "marzo-abril: temporada alta de contratación en Chile (volumen de postulantes)",
      "cómo filtrar cientos de CVs sin perder a los buenos",
      "onboarding: los primeros 90 días deciden si la contratación fue buena",
      "presupuesto de RRHH: el costo real de una mala contratación",
    ],
  },
  invierno: {
    name: "invierno",
    angles: [
      "reemplazos y licencias: contratar bien incluso apurado",
      "evaluación de desempeño de mitad de año y detección de brechas",
      "rotación de personal: por qué renuncian y cómo anticiparlo en la selección",
      "equipos bajo presión: el costo de un mal jefe contratado a la rápida",
    ],
  },
  primavera: {
    name: "primavera",
    angles: [
      "refuerzos para el peak de fin de año (retail, servicios, logística)",
      "contratación de temporada navideña sin bajar el estándar",
      "planificación de dotación del próximo año",
      "cierre de año: evaluar al equipo con datos, no con impresiones",
    ],
  },
};

function seasonFor(month: number): SeasonInfo {
  // Hemisferio sur: dic-feb verano, mar-may otoño, jun-ago invierno, sep-nov primavera
  if (month === 12 || month <= 2) return SEASONS.verano;
  if (month <= 5) return SEASONS.otono;
  if (month <= 8) return SEASONS.invierno;
  return SEASONS.primavera;
}

const MONTHS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** Párrafo de contexto estacional para inyectar en el prompt de ideas */
export function seasonContext(date = new Date()): string {
  const month = date.getMonth() + 1;
  const season = seasonFor(month);
  return (
    `Contexto de temporada: estamos en ${MONTHS[month - 1]}, ${season.name} en Chile. ` +
    `Ángulos de temporada que puedes aprovechar cuando calcen con el tema (sin forzarlos): ` +
    season.angles.join("; ") + "."
  );
}
