/**
 * Verifica que la dirección de arte de las imágenes varíe. Antes todas recibían el
 * mismo prompt —«dark premium corporate photography, modern office environment...
 * professional people in business settings»—: piezas idénticas, y oficinas
 * corporativas cuando el cliente de ReclutMatch es el dueño de una PYME.
 *
 *   npm run test-arte
 */
import { styleWrap, semilla } from "../lib/render/carousel";

const negocio = { slug: "reclutmatch", name: "ReclutMatch", description: "Selección", tagline: "" } as never;
let fallas = 0;
const chk = (ok: boolean, d: string) => { console.log((ok ? "  OK   " : "  MAL  ") + d); if (!ok) fallas++; };

const marcas = ["Candid documentary", "Close-up detail", "Two people talking", "small team working", "Dark premium editorial"];
const trat = (s: string) => marcas.find((m) => s.includes(m));
const desp = semilla("El mejor vendedor no siempre es el mejor jefe");

const cinco = [0, 1, 2, 3, 4].map((i) => styleWrap("x", negocio, i, desp));
chk(new Set(cinco.map(trat)).size === 5, "5 láminas -> 5 tratamientos distintos");
chk(cinco.filter((s) => s.includes("Dark premium")).length === 1, "el oscuro corporativo sale 1 de 5 veces, no siempre");

const seis = [0, 1, 2, 3, 4, 5].map((i) => styleWrap("x", negocio, i, desp).match(/Setting: ([^.]+)\./)?.[1]);
chk(new Set(seis).size === 6, `6 láminas -> 6 escenarios PYME distintos`);

const todos = Array.from({ length: 30 }, (_, i) => styleWrap("x", negocio, i, 0));
chk(!todos.some((s) => /modern office environment|professional people in business settings/.test(s)),
  "ya no aparece la oficina corporativa del prompt viejo");

const titulos = ["Contratar por simpatía", "El cargo mal definido", "Big Five sin humo", "La ley de datos",
  "El test gratis", "Tres renuncias en un año", "La entrevista estructurada", "El informe de una página",
  "Ascender al mejor vendedor", "El costo de rotar"];
const arranques = new Set(titulos.map((t) => trat(styleWrap("x", negocio, 0, semilla(t)))));
chk(arranques.size >= 3, `10 piezas arrancan en ${arranques.size} tratamientos distintos (>=3)`);

console.log(fallas === 0 ? "\nTodo en orden." : `\n${fallas} fallas`);
process.exit(fallas === 0 ? 0 : 1);
