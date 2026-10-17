/**
 * Verifica la voz de ReclutMatch: la mezcla que eligió Rodrigo para Garage Pro
 * (base "el que te explica", una de cada tres contada como caso), aplicada acá con
 * personas que le hablan al dueño de una PYME.
 *
 *   npm run test-voz
 */
import { elegirRegistro, vozDeMarca } from "../lib/ideas/voz";

let fallas = 0;
const chk = (ok: boolean, d: string) => { console.log((ok ? "  OK   " : "  MAL  ") + d); if (!ok) fallas++; };

delete process.env.VOZ;

const turnos = Array.from({ length: 30 }, (_, i) => elegirRegistro(i));
const c = turnos.filter((r) => r === "c").length;
const a = turnos.filter((r) => r === "a").length;
chk(c === 10 && a === 20, `30 piezas -> ${a} "te explica" + ${c} "cuenta lo que pasa" (debe ser 20 + 10)`);
chk(!turnos.some((r, i) => r === "c" && turnos[i + 1] === "c"), "nunca dos piezas contadas como caso seguidas");

process.env.VOZ = "b";
chk(elegirRegistro(2) === "b", "VOZ=b fija el registro aunque al turno le tocara c");
delete process.env.VOZ;

for (const r of ["a", "b", "c"] as const) {
  const v = vozDeMarca(r);
  chk(v.includes("Nada de estadísticas"), `(${r}) prohíbe porcentajes y "según estudios"`);
  chk(!/mecánico|taller/i.test(v), `(${r}) no se le coló la voz de Garage Pro`);
}
chk(vozDeMarca("a").includes("PYME"), "(a) le habla al dueño de una PYME");

console.log(fallas === 0 ? "\nTodo en orden." : `\n${fallas} fallas`);
process.exit(fallas === 0 ? 0 : 1);
