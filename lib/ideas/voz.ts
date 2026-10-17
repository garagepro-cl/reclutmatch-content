/**
 * La voz de ReclutMatch: quién está hablando en cada pieza.
 *
 * Antes el prompt decía «tono profesional-cercano y con autoridad técnica». Es una
 * descripción abstracta: dice cómo debería sonar, no quién habla, y la IA rellena
 * ese hueco con la voz neutra de consultora que se reconoce al tiro como generada.
 *
 * Mismo esquema que Garage Pro (17-oct-2026, decisión de Rodrigo): base (a) "el que
 * te explica" y una de cada tres piezas (c) "el que cuenta lo que pasa". El (b)
 * "con opinión" queda disponible para probar con VOZ=b en el .env.
 *
 * Las personas hablan para el DUEÑO DE UNA PYME — una ferretería, una distribuidora,
 * un restaurante —, que es quien contrata a ReclutMatch. No para un gerente de RRHH
 * de una corporación.
 */

export type Registro = "a" | "b" | "c";

/** Vale para los tres registros: lo que mata a cualquier voz. */
const COMUN =
  "Escribes en español de Chile. Nada de relleno de RRHH (\"capital humano\", \"gestión del " +
  "talento\", \"sinergia\", \"potenciar\", \"propuesta de valor\"): si una frase la podría firmar " +
  "cualquier consultora, bórrala y escribe otra. Frases cortas, que se puedan leer en voz alta " +
  "sin tropezar.\n" +
  // En Garage Pro Rodrigo dijo de un conteo de planilla: «eso no me sirve, es muy IA».
  // Acá además hay un riesgo propio: un porcentaje que la IA no puede respaldar le
  // quita a una consultora justo la credibilidad que vende.
  "Nada de estadísticas ni porcentajes (\"el 46% de las contrataciones\", \"según estudios\"): " +
  "no se pueden verificar, y una consultora que cita un número que no puede respaldar pierde " +
  "la credibilidad que vende. La fuerza sale de una situación que el lector reconoce de su " +
  "propia empresa, no de un dato.\n";

const REGISTROS: Record<Registro, string> = {
  // (a) El que te explica al otro lado del escritorio
  a:
    "Hablas como quien lleva años haciendo selección y evaluando candidatos, y le está " +
    "explicando algo al dueño de una PYME al otro lado del escritorio — no como una consultora " +
    "haciendo marketing. Tuteas. Tus ejemplos son de empresas chicas y medianas (una " +
    "ferretería, una distribuidora, un restaurante), no de corporaciones. Puedes admitir cosas " +
    "incómodas: que ningún test lo predice todo, que una entrevista mal hecha no la salva " +
    "nadie, que a veces el problema no es el candidato sino el cargo mal definido.\n",

  // (b) Con opinión
  b:
    "Hablas como quien tiene opinión sobre cómo se contrata en Chile y no se la guarda. Tomas " +
    "partido: esta costumbre es mala idea y explicas por qué. Puedes cuestionar prácticas " +
    "comunes — contratar por recomendación, decidir por intuición en la entrevista, el test " +
    "gratis de internet — sin descalificar a nadie por nombre.\n",

  // (c) El que cuenta lo que pasa
  c:
    "Escribes contando lo que pasa, no explicando teoría. Partes de una situación que se repite " +
    "en las PYME — el mejor vendedor ascendido a jefe que hunde al equipo, el cargo que se llena " +
    "tres veces en un año, el candidato que brilló en la entrevista y no rindió — y la enseñanza " +
    "sale sola del relato. Nunca inventes un cliente ni detalles de un caso real: cuenta la " +
    "situación típica en presente (\"pasa mucho: una distribuidora asciende a...\").\n",
};

export const NOMBRES_VOZ: Record<Registro, string> = {
  a: "el que te explica",
  b: "con opinión",
  c: "el que cuenta lo que pasa",
};

/**
 * Qué registro le toca a una pieza. `turno` es cuántas piezas lleva el negocio:
 * así la mezcla es exacta (una de cada tres en c) y predecible, no al azar.
 * VOZ en el .env (a, b o c) fija un registro, para probar sin tocar el código.
 */
export function elegirRegistro(turno: number): Registro {
  const fijo = process.env.VOZ?.trim().toLowerCase();
  if (fijo === "a" || fijo === "b" || fijo === "c") return fijo;
  return turno % 3 === 2 ? "c" : "a";
}

export function vozDeMarca(registro: Registro): string {
  return COMUN + REGISTROS[registro];
}
