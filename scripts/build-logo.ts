/**
 * Rasteriza assets/brands/<slug>/logo.svg → logo.png (para plantillas satori).
 * Uso: npm run build:logo
 */
import fs from "node:fs";
import path from "node:path";
import { Resvg } from "@resvg/resvg-js";

const brandsDir = path.join(process.cwd(), "assets", "brands");

for (const slug of fs.readdirSync(brandsDir)) {
  const svgPath = path.join(brandsDir, slug, "logo.svg");
  const pngPath = path.join(brandsDir, slug, "logo.png");
  if (!fs.existsSync(svgPath)) continue;

  const svg = fs.readFileSync(svgPath, "utf8");
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: 1800 },
    font: { loadSystemFonts: true },
    background: "rgba(0,0,0,0)",
  });
  fs.writeFileSync(pngPath, resvg.render().asPng());
  console.log(`✔ ${slug}/logo.png generado (${pngPath})`);
}
