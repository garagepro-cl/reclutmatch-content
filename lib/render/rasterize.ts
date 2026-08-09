import fs from "node:fs";
import path from "node:path";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import { loadFonts } from "./fonts";
import type { El } from "./tree";

/**
 * Renderiza una lista de árboles satori a PNGs numerados en outDir.
 * Devuelve los nombres de archivo generados.
 */
export async function renderElements(
  elements: El[],
  width: number,
  height: number,
  outDir: string,
  prefix = "slide",
): Promise<string[]> {
  fs.mkdirSync(outDir, { recursive: true });
  const fonts = loadFonts();
  const files: string[] = [];

  for (let i = 0; i < elements.length; i++) {
    const svg = await satori(elements[i] as never, {
      width,
      height,
      fonts: fonts.map((f) => ({
        name: f.name,
        data: f.data,
        weight: f.weight,
        style: f.style,
      })),
    });
    const png = new Resvg(svg, {
      font: { loadSystemFonts: false },
    }).render().asPng();

    const name = `${prefix}-${String(i + 1).padStart(2, "0")}.png`;
    fs.writeFileSync(path.join(outDir, name), png);
    files.push(name);
  }

  return files;
}
