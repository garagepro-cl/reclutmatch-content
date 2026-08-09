import fs from "node:fs";
import path from "node:path";

export interface FontSpec {
  name: string;
  data: Buffer;
  weight: 400 | 700 | 900;
  style: "normal";
}

/** Fuente display condensada para titulares (Anton). Opcional. */
const DISPLAY_FILE = path.join(process.cwd(), "assets", "fonts", "display.ttf");

export function hasDisplayFont(): boolean {
  return fs.existsSync(DISPLAY_FILE);
}

const WIN_FONTS = "C:\\Windows\\Fonts";
const PROJECT_FONTS = path.join(process.cwd(), "assets", "fonts");

/**
 * Resolución de fuentes: primero assets/fonts (regular/bold/black.ttf),
 * luego fuentes del sistema Windows (Segoe UI), luego Arial.
 * En un VPS Linux basta con dejar los .ttf en assets/fonts.
 */
const CANDIDATES: Array<{ weight: 400 | 700 | 900; files: string[] }> = [
  {
    weight: 400,
    files: [
      path.join(PROJECT_FONTS, "regular.ttf"),
      path.join(WIN_FONTS, "segoeui.ttf"),
      path.join(WIN_FONTS, "arial.ttf"),
    ],
  },
  {
    weight: 700,
    files: [
      path.join(PROJECT_FONTS, "bold.ttf"),
      path.join(WIN_FONTS, "segoeuib.ttf"),
      path.join(WIN_FONTS, "arialbd.ttf"),
    ],
  },
  {
    weight: 900,
    files: [
      path.join(PROJECT_FONTS, "black.ttf"),
      path.join(WIN_FONTS, "seguibl.ttf"),
      path.join(WIN_FONTS, "ariblk.ttf"),
    ],
  },
];

let cache: FontSpec[] | null = null;

export function loadFonts(): FontSpec[] {
  if (cache) return cache;
  const fonts: FontSpec[] = [];

  for (const { weight, files } of CANDIDATES) {
    const found = files.find((f) => fs.existsSync(f));
    if (found) {
      fonts.push({ name: "Brand", data: fs.readFileSync(found), weight, style: "normal" });
    }
  }

  if (fonts.length === 0) {
    throw new Error(
      "No se encontraron fuentes. Copia archivos .ttf a assets/fonts/ " +
      "con los nombres regular.ttf, bold.ttf y black.ttf",
    );
  }

  if (hasDisplayFont()) {
    fonts.push({ name: "Display", data: fs.readFileSync(DISPLAY_FILE), weight: 400, style: "normal" });
  }

  cache = fonts;
  return fonts;
}
