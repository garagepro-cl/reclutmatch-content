import fs from "node:fs";
import path from "node:path";
import type { Business } from "@prisma/client";
import { type Brand, brandAssetDir } from "../brands";
import { type El, type Child, h, img, rgba, stripEmoji } from "./tree";
import type { IdeaSlide } from "../ideas/types";

export interface RenderData {
  title: string;
  hook: string;
  pillar: string;
  slides: IdeaSlide[];
}

export const CAROUSEL_W = 1080;
export const CAROUSEL_H = 1350;
export const VIDEO_W = 1080;
export const VIDEO_H = 1920;

/* ── Logo ──────────────────────────────────────────────────────────── */

const logoCache = new Map<string, string>();

function logoDataUrl(slug: string, brand: Brand): string {
  const key = `${slug}/${brand.logoFile}`;
  const hit = logoCache.get(key);
  if (hit) return hit;
  const file = path.join(brandAssetDir(slug), brand.logoFile);
  const ext = path.extname(file).slice(1) || "png";
  const url = `data:image/${ext};base64,${fs.readFileSync(file).toString("base64")}`;
  logoCache.set(key, url);
  return url;
}

/** Placa negra redondeada con el logo dentro (ambos logos tienen fondo oscuro) */
function logoPlate(slug: string, brand: Brand, height: number): El {
  const width = Math.round(height * brand.logoAspect);
  return h(
    "div",
    {
      display: "flex",
      backgroundColor: "#050506",
      borderRadius: 18,
      border: `1px solid ${rgba(brand.silver, 0.18)}`,
      padding: "18px 34px",
      alignItems: "center",
      justifyContent: "center",
    },
    img(logoDataUrl(slug, brand), width, height),
  );
}

/* ── Piezas compartidas ────────────────────────────────────────────── */

function rootStyle(brand: Brand, w: number, hgt: number, padding: string) {
  return {
    display: "flex",
    flexDirection: "column",
    width: w,
    height: hgt,
    backgroundColor: brand.bg,
    backgroundImage:
      `linear-gradient(150deg, ${rgba(brand.primary, 0.16)} 0%, ${rgba(brand.primary, 0)} 42%), ` +
      `linear-gradient(330deg, ${rgba(brand.accent, 0.1)} 0%, ${rgba(brand.accent, 0)} 38%)`,
    padding,
    justifyContent: "space-between",
    fontFamily: "Brand",
    color: brand.text,
  };
}

function chip(text: string, brand: Brand, fontSize = 26): El {
  return h(
    "div",
    {
      display: "flex",
      backgroundColor: rgba(brand.primary, 0.14),
      border: `1px solid ${rgba(brand.primary, 0.45)}`,
      borderRadius: 999,
      padding: "12px 30px",
      color: brand.primaryLight,
      fontSize,
      fontWeight: 700,
      letterSpacing: 3,
      textTransform: "uppercase",
    },
    stripEmoji(text),
  );
}

function accentBar(brand: Brand, width = 130): El {
  return h("div", {
    display: "flex",
    width,
    height: 10,
    borderRadius: 6,
    backgroundImage: `linear-gradient(90deg, ${brand.primary}, ${brand.primaryLight})`,
  });
}

function dots(total: number, active: number, brand: Brand): El {
  const items: El[] = [];
  for (let i = 0; i < total; i++) {
    items.push(
      h("div", {
        display: "flex",
        width: i === active ? 30 : 12,
        height: 12,
        borderRadius: 999,
        backgroundColor: i === active ? brand.primary : rgba(brand.silver, 0.28),
      }),
    );
  }
  return h("div", { display: "flex", gap: 10, alignItems: "center" }, items);
}

/* ── Carrusel 1080×1350 ────────────────────────────────────────────── */

export function buildCarouselSlides(
  business: Business,
  brand: Brand,
  data: RenderData,
): El[] {
  const content = data.slides.slice(0, 7);
  const total = content.length + 2;
  const els: El[] = [];

  /* Portada */
  const titleSize = data.title.length > 48 ? 70 : data.title.length > 30 ? 80 : 92;
  els.push(
    h(
      "div",
      rootStyle(brand, CAROUSEL_W, CAROUSEL_H, "68px 72px"),
      h("div", { display: "flex", justifyContent: "center", width: "100%" },
        logoPlate(business.slug, brand, 74),
      ),
      h(
        "div",
        { display: "flex", flexDirection: "column", gap: 36, alignItems: "flex-start" },
        data.pillar ? chip(data.pillar, brand) : accentBar(brand),
        h("div", {
          display: "flex",
          fontSize: titleSize,
          fontWeight: 900,
          lineHeight: 1.08,
          color: brand.text,
        }, stripEmoji(data.title)),
        data.hook
          ? h("div", {
              display: "flex",
              fontSize: 38,
              lineHeight: 1.4,
              color: brand.muted,
            }, stripEmoji(data.hook))
          : null,
      ),
      h(
        "div",
        { display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" },
        h("div", { display: "flex", fontSize: 30, color: brand.silver, fontWeight: 700 },
          business.instagram,
        ),
        h("div", {
          display: "flex",
          fontSize: 28,
          color: brand.primaryLight,
          fontWeight: 700,
          letterSpacing: 2,
        }, "DESLIZA →"),
      ),
    ),
  );

  /* Slides de contenido */
  content.forEach((slide, i) => {
    els.push(
      h(
        "div",
        rootStyle(brand, CAROUSEL_W, CAROUSEL_H, "60px 72px"),
        h(
          "div",
          { display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" },
          logoPlate(business.slug, brand, 42),
          h("div", {
            display: "flex",
            fontSize: 130,
            fontWeight: 900,
            color: rgba(brand.primary, 0.22),
            lineHeight: 1,
          }, String(i + 1).padStart(2, "0")),
        ),
        h(
          "div",
          { display: "flex", flexDirection: "column", gap: 34, alignItems: "flex-start" },
          h("div", {
            display: "flex",
            fontSize: 56,
            fontWeight: 900,
            lineHeight: 1.15,
            color: brand.primaryLight,
          }, stripEmoji(slide.title)),
          accentBar(brand, 110),
          h("div", {
            display: "flex",
            fontSize: 40,
            lineHeight: 1.55,
            color: "#DDE1E6",
          }, stripEmoji(slide.body)),
        ),
        h(
          "div",
          { display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" },
          h("div", { display: "flex", fontSize: 27, color: brand.muted },
            business.instagram,
          ),
          dots(total, i + 1, brand),
        ),
      ),
    );
  });

  /* Cierre / CTA */
  els.push(
    h(
      "div",
      {
        ...rootStyle(brand, CAROUSEL_W, CAROUSEL_H, "72px"),
        justifyContent: "center",
        alignItems: "center",
        gap: 48,
      },
      logoPlate(business.slug, brand, 110),
      h("div", {
        display: "flex",
        fontSize: 30,
        color: brand.silver,
        letterSpacing: 6,
        textTransform: "uppercase",
        fontWeight: 700,
        textAlign: "center",
      }, stripEmoji(business.tagline)),
      h("div", {
        display: "flex",
        fontSize: 74,
        fontWeight: 900,
        color: brand.text,
        textAlign: "center",
        lineHeight: 1.1,
      }, stripEmoji(business.ctaText)),
      h("div", {
        display: "flex",
        backgroundImage: `linear-gradient(90deg, ${brand.primary}, ${brand.primaryLight})`,
        color: "#0B0B0D",
        fontSize: 40,
        fontWeight: 700,
        padding: "26px 64px",
        borderRadius: 999,
      }, business.instagram),
      business.website
        ? h("div", { display: "flex", fontSize: 34, color: brand.muted },
            business.website,
          )
        : null,
    ),
  );

  return els;
}

/* ── Carrusel 1080×1350 con fondo real (overlay transparente) ───────── */

/**
 * Igual que buildCarouselSlides pero sin fondo opaco: se usa como overlay
 * sobre una foto real generada por IA (GPT Image 2). Agrega una placa
 * oscura translúcida detrás del texto para que sea legible sobre cualquier foto.
 */
export function buildCarouselOverlaySlides(
  business: Business,
  brand: Brand,
  data: RenderData,
): El[] {
  const content = data.slides.slice(0, 7);
  const total = content.length + 2;
  const els: El[] = [];
  const panel = (children: Child[]) =>
    h(
      "div",
      {
        display: "flex",
        flexDirection: "column",
        gap: 30,
        alignItems: "flex-start",
        backgroundColor: rgba("#000000", 0.55),
        borderRadius: 28,
        padding: "36px 38px",
      },
      ...children,
    );
  const root = (children: Child[]) =>
    h(
      "div",
      {
        display: "flex",
        flexDirection: "column",
        width: CAROUSEL_W,
        height: CAROUSEL_H,
        padding: "60px 72px",
        justifyContent: "space-between",
        fontFamily: "Brand",
        color: brand.text,
      },
      ...children,
    );

  /* Portada */
  const titleSize = data.title.length > 48 ? 66 : data.title.length > 30 ? 76 : 86;
  els.push(
    root([
      h("div", { display: "flex", justifyContent: "center", width: "100%" }, logoPlate(business.slug, brand, 74)),
      panel([
        data.pillar ? chip(data.pillar, brand) : accentBar(brand),
        h("div", { display: "flex", fontSize: titleSize, fontWeight: 900, lineHeight: 1.08, color: brand.text },
          stripEmoji(data.title)),
        data.hook
          ? h("div", { display: "flex", fontSize: 34, lineHeight: 1.4, color: "#EDEFF2" }, stripEmoji(data.hook))
          : null,
      ]),
      h(
        "div",
        { display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" },
        h("div", {
          display: "flex", fontSize: 28, color: brand.text, fontWeight: 700,
          backgroundColor: rgba("#000000", 0.55), borderRadius: 12, padding: "6px 16px",
        }, business.instagram),
        h("div", {
          display: "flex", fontSize: 26, color: brand.primaryLight, fontWeight: 700, letterSpacing: 2,
          backgroundColor: rgba("#000000", 0.55), borderRadius: 12, padding: "6px 16px",
        }, "DESLIZA →"),
      ),
    ]),
  );

  /* Slides de contenido */
  content.forEach((slide, i) => {
    els.push(
      root([
        h(
          "div",
          { display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" },
          logoPlate(business.slug, brand, 42),
          h("div", {
            display: "flex", fontSize: 110, fontWeight: 900, color: rgba("#FFFFFF", 0.4), lineHeight: 1,
          }, String(i + 1).padStart(2, "0")),
        ),
        panel([
          h("div", { display: "flex", fontSize: 50, fontWeight: 900, lineHeight: 1.15, color: brand.primaryLight },
            stripEmoji(slide.title)),
          accentBar(brand, 110),
          h("div", { display: "flex", fontSize: 36, lineHeight: 1.5, color: "#EDEFF2" }, stripEmoji(slide.body)),
        ]),
        h(
          "div",
          { display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" },
          h("div", {
            display: "flex", fontSize: 25, color: brand.text,
            backgroundColor: rgba("#000000", 0.55), borderRadius: 10, padding: "6px 14px",
          }, business.instagram),
          h("div", { backgroundColor: rgba("#000000", 0.55), borderRadius: 10, padding: "6px 14px", display: "flex" },
            dots(total, i + 1, brand)),
        ),
      ]),
    );
  });

  /* Cierre / CTA */
  els.push(
    h(
      "div",
      {
        display: "flex", flexDirection: "column", width: CAROUSEL_W, height: CAROUSEL_H, padding: "72px",
        justifyContent: "center", alignItems: "center", gap: 40, fontFamily: "Brand", color: brand.text,
      },
      panel([
        h("div", { display: "flex", flexDirection: "column", gap: 40, alignItems: "center" }, [
          logoPlate(business.slug, brand, 100),
          h("div", { display: "flex", fontSize: 28, color: brand.silver, letterSpacing: 5, textTransform: "uppercase", fontWeight: 700, textAlign: "center" },
            stripEmoji(business.tagline)),
          h("div", { display: "flex", fontSize: 62, fontWeight: 900, color: brand.text, textAlign: "center", lineHeight: 1.1 },
            stripEmoji(business.ctaText)),
          h("div", {
            display: "flex", backgroundImage: `linear-gradient(90deg, ${brand.primary}, ${brand.primaryLight})`,
            color: "#0B0B0D", fontSize: 36, fontWeight: 700, padding: "22px 56px", borderRadius: 999,
          }, business.instagram),
          business.website
            ? h("div", { display: "flex", fontSize: 30, color: "#EDEFF2" }, business.website)
            : null,
        ]),
      ]),
    ),
  );

  return els;
}

/* ── Video 1080×1920 con fondo real (overlay transparente) ─────────── */

/**
 * Igual que buildVideoSlides pero sin fondo opaco: se usa como overlay
 * sobre un clip de video real (Veo3). Agrega una placa oscura translúcida
 * detrás del texto para que siga siendo legible sobre cualquier metraje.
 */
export function buildVideoOverlaySlides(
  business: Business,
  brand: Brand,
  data: RenderData,
): El[] {
  const slides = data.slides.slice(0, 8);
  const total = slides.length;

  return slides.map((slide, i) => {
    const isFirst = i === 0;
    const isLast = i === total - 1;
    const titleSize = isFirst ? 80 : 66;

    return h(
      "div",
      {
        display: "flex",
        flexDirection: "column",
        width: VIDEO_W,
        height: VIDEO_H,
        padding: "200px 90px 300px 90px",
        justifyContent: "space-between",
        alignItems: "center",
        fontFamily: "Brand",
        color: brand.text,
      },
      h("div", { display: "flex", justifyContent: "center" },
        logoPlate(business.slug, brand, isFirst ? 80 : 56),
      ),
      h(
        "div",
        {
          display: "flex",
          flexDirection: "column",
          gap: 40,
          alignItems: "center",
          width: "100%",
          backgroundColor: rgba("#000000", 0.52),
          borderRadius: 32,
          padding: "48px 44px",
        },
        isFirst && data.pillar ? chip(data.pillar, brand, 28) : null,
        h("div", {
          display: "flex",
          fontSize: titleSize,
          fontWeight: 900,
          lineHeight: 1.12,
          color: isFirst ? brand.text : brand.primaryLight,
          textAlign: "center",
          justifyContent: "center",
        }, stripEmoji(slide.title)),
        accentBar(brand, 140),
        h("div", {
          display: "flex",
          fontSize: 46,
          lineHeight: 1.5,
          color: "#EDEFF2",
          textAlign: "center",
          justifyContent: "center",
        }, stripEmoji(slide.body)),
        isLast
          ? h("div", {
              display: "flex",
              backgroundImage: `linear-gradient(90deg, ${brand.primary}, ${brand.primaryLight})`,
              color: "#0B0B0D",
              fontSize: 42,
              fontWeight: 700,
              padding: "26px 64px",
              borderRadius: 999,
              marginTop: 10,
            }, business.instagram)
          : null,
      ),
      h(
        "div",
        { display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" },
        h("div", {
          display: "flex",
          fontSize: 30,
          color: brand.text,
          backgroundColor: rgba("#000000", 0.52),
          borderRadius: 12,
          padding: "8px 18px",
        }, business.instagram),
        h("div", {
          display: "flex",
          fontSize: 30,
          color: brand.text,
          backgroundColor: rgba("#000000", 0.52),
          borderRadius: 12,
          padding: "8px 18px",
        }, `${i + 1}/${total}`),
      ),
    );
  });
}

/* ── Video 1080×1920 (slides para animar) ──────────────────────────── */

export function buildVideoSlides(
  business: Business,
  brand: Brand,
  data: RenderData,
): El[] {
  const slides = data.slides.slice(0, 8);
  const total = slides.length;

  return slides.map((slide, i) => {
    const isFirst = i === 0;
    const isLast = i === total - 1;
    const titleSize = isFirst ? 88 : 72;

    return h(
      "div",
      {
        ...rootStyle(brand, VIDEO_W, VIDEO_H, "200px 90px 300px 90px"),
        justifyContent: "space-between",
        alignItems: "center",
      },
      h("div", { display: "flex", justifyContent: "center" },
        logoPlate(business.slug, brand, isFirst ? 80 : 56),
      ),
      h(
        "div",
        {
          display: "flex",
          flexDirection: "column",
          gap: 44,
          alignItems: "center",
          width: "100%",
        },
        isFirst && data.pillar ? chip(data.pillar, brand, 28) : null,
        h("div", {
          display: "flex",
          fontSize: titleSize,
          fontWeight: 900,
          lineHeight: 1.12,
          color: isFirst ? brand.text : brand.primaryLight,
          textAlign: "center",
          justifyContent: "center",
        }, stripEmoji(slide.title)),
        accentBar(brand, 140),
        h("div", {
          display: "flex",
          fontSize: 52,
          lineHeight: 1.5,
          color: "#DDE1E6",
          textAlign: "center",
          justifyContent: "center",
        }, stripEmoji(slide.body)),
        isLast
          ? h("div", {
              display: "flex",
              backgroundImage: `linear-gradient(90deg, ${brand.primary}, ${brand.primaryLight})`,
              color: "#0B0B0D",
              fontSize: 42,
              fontWeight: 700,
              padding: "26px 64px",
              borderRadius: 999,
              marginTop: 10,
            }, business.instagram)
          : null,
      ),
      h(
        "div",
        { display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" },
        h("div", { display: "flex", fontSize: 30, color: brand.muted },
          business.instagram,
        ),
        h("div", { display: "flex", fontSize: 30, color: rgba(brand.silver, 0.6) },
          `${i + 1}/${total}`,
        ),
      ),
    );
  });
}
