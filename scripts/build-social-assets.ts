/**
 * Rasteriza avatar.svg y cover.svg de un negocio a PNG en alta resolución.
 * Uso: npx tsx scripts/build-social-assets.ts euro-pro-parts
 */
import fs from "node:fs";
import path from "node:path";
import { Resvg } from "@resvg/resvg-js";

const slug = process.argv[2];
if (!slug) {
  console.error("Uso: npx tsx scripts/build-social-assets.ts <slug>");
  process.exit(1);
}

const dir = path.join(process.cwd(), "assets", "brands", slug);

for (const name of ["avatar", "cover"]) {
  const svgPath = path.join(dir, `${name}.svg`);
  if (!fs.existsSync(svgPath)) continue;
  const svg = fs.readFileSync(svgPath, "utf8");
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: name === "avatar" ? 1000 : 1200 },
    font: { loadSystemFonts: true },
  });
  const pngPath = path.join(dir, `${name}.png`);
  fs.writeFileSync(pngPath, resvg.render().asPng());
  console.log(`✔ ${name}.png generado`);
}
