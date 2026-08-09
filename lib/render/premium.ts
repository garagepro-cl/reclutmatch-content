import fs from "node:fs";
import path from "node:path";
import type { Business } from "@prisma/client";
import { type Brand, brandAssetDir } from "../brands";
import { type El, type Child, h, rgba, stripEmoji } from "./tree";
import type { IdeaSlide, SlideLayout } from "../ideas/types";
import { CAROUSEL_W as W, CAROUSEL_H as H } from "./templates";
import { hasDisplayFont } from "./fonts";

/**
 * Plantillas "premium" estilo material de marketing aprobado:
 * fondo marino profundo, tipografía blanca gigante con punto violeta,
 * fotos oscuras fundidas al fondo con gradientes, layouts variados por slide.
 */

export interface PremiumRenderData {
  title: string;
  hook: string;
  pillar: string;
  slides: IdeaSlide[];
  /** Descripción EN de la imagen de portada (para generar con IA) */
  coverImagePrompt?: string;
  /** Foto real de la biblioteca para la portada */
  coverPhoto?: string;
}

/** Imágenes ya resueltas (data URLs JPEG): portada + una por slide (o undefined) */
export interface ResolvedImages {
  cover?: string;
  slides: (string | undefined)[];
}

const BG = "#130C3D";
const BODY_COLOR = "#DAD8EC";
const MUTED = "#9D98C8";
const RED = "#E5484D";

/* ── Helpers ───────────────────────────────────────────────────────── */

interface LogoAsset {
  dataUrl: string;
  aspect: number;
}

const logoCache = new Map<string, LogoAsset>();

/** Lee ancho/alto del encabezado IHDR de un PNG (sin dependencias) */
function pngSize(buf: Buffer): { width: number; height: number } | null {
  if (buf.length < 24 || buf.readUInt32BE(12) !== 0x49484452 /* IHDR */) return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

/**
 * Logo del negocio. Prefiere logo-trim.png (sin márgenes transparentes,
 * generado con sharp().trim()) porque el logo original puede venir con el
 * arte flotando en un lienzo gigante y se vería diminuto.
 */
function logoAsset(slug: string, brand: Brand): LogoAsset {
  const hit = logoCache.get(slug);
  if (hit) return hit;

  const trimmed = path.join(brandAssetDir(slug), "logo-trim.png");
  let file = path.join(brandAssetDir(slug), brand.logoFile);
  let aspect = brand.logoAspect;

  if (fs.existsSync(trimmed)) {
    const buf = fs.readFileSync(trimmed);
    const size = pngSize(buf);
    if (size && size.height > 0) {
      file = trimmed;
      aspect = size.width / size.height;
    }
  }

  const ext = path.extname(file).slice(1) || "png";
  const asset: LogoAsset = {
    dataUrl: `data:image/${ext};base64,${fs.readFileSync(file).toString("base64")}`,
    aspect,
  };
  logoCache.set(slug, asset);
  return asset;
}

function logo(slug: string, brand: Brand, height: number): El {
  const { dataUrl, aspect } = logoAsset(slug, brand);
  const width = Math.round(height * aspect);
  return {
    type: "img",
    props: { src: dataUrl, width, height, style: { objectFit: "contain" } },
  };
}

/** Placa oscura con borde sutil para que el logo se lea sobre fotos */
function logoPlate(slug: string, brand: Brand, height: number): El {
  return h(
    "div",
    {
      display: "flex",
      backgroundColor: "#0E0930",
      borderRadius: 16,
      border: `1px solid ${rgba(brand.silver, 0.24)}`,
      padding: "10px 20px",
      alignItems: "center",
      justifyContent: "center",
    },
    logo(slug, brand, height),
  );
}

/** Foto a pantalla completa (detrás de todo) */
function fullBleedPhoto(dataUrl: string): El {
  return {
    type: "img",
    props: {
      src: dataUrl,
      width: W,
      height: H,
      style: { position: "absolute", top: 0, left: 0, objectFit: "cover" },
    },
  };
}

/** Capa de gradiente absoluta sobre la foto */
function overlay(backgroundImage: string): El {
  return h("div", {
    position: "absolute",
    top: 0,
    left: 0,
    width: W,
    height: H,
    backgroundImage,
  });
}

/** Número de slide arriba a la izquierda, amarillo */
function slideNumber(n: number, brand: Brand): El {
  return h(
    "div",
    { display: "flex", fontSize: 30, fontWeight: 700, color: brand.primary, letterSpacing: 3 },
    String(n).padStart(2, "0"),
  );
}

/**
 * Título con punto final amarillo. Satori no fluye spans inline en texto
 * multilínea, así que el título se arma palabra por palabra con flex-wrap
 * y el punto va pegado a la última palabra.
 */
function titleWithDot(
  text: string,
  brand: Brand,
  opts: {
    size: number;
    lineHeight: number;
    color?: string;
    letterSpacing?: number;
    uppercase?: boolean;
    maxWidth?: number | string;
    /** Usa la fuente display condensada (Anton) — solo para el hero de portada */
    display?: boolean;
  },
): El {
  const clean = stripEmoji(text).replace(/\.+$/, "");
  const endsInPunct = /[?!…]$/.test(clean);
  const words = clean.split(/\s+/).filter(Boolean);
  const S = opts.size;
  const useDisplay = Boolean(opts.display) && hasDisplayFont();

  const wordStyle: Record<string, unknown> = {
    display: "flex",
    fontFamily: useDisplay ? "Display" : "Brand",
    fontSize: S,
    fontWeight: useDisplay ? 400 : 900,
    lineHeight: 1.06,
    color: opts.color ?? "#FFFFFF",
    letterSpacing: opts.letterSpacing ?? (useDisplay ? 0 : -1),
    textTransform: opts.uppercase ? "uppercase" : "none",
  };

  const items: Child[] = words.map((w, i) => {
    const isLast = i === words.length - 1;
    if (isLast && !endsInPunct) {
      return h(
        "div",
        wordStyle,
        w,
        { type: "span", props: { style: { color: brand.primary }, children: "." } } as El,
      );
    }
    return h("div", wordStyle, w);
  });

  const style: Record<string, unknown> = {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "flex-end",
    rowGap: Math.max(2, Math.round(S * (opts.lineHeight - 1.06))),
    columnGap: Math.round(S * 0.24),
  };
  if (opts.maxWidth !== undefined) style.maxWidth = opts.maxWidth;
  return h("div", style, ...items);
}

function accentBar(brand: Brand, width = 96): El {
  return h("div", {
    display: "flex",
    width,
    height: 8,
    borderRadius: 5,
    backgroundColor: brand.primary,
  });
}

/** Marca ✗ dibujada (dos barras rotadas) — no depende de glifos de la fuente */
function xMark(size = 30): El {
  const bar = (deg: number) =>
    h("div", {
      position: "absolute",
      top: size / 2 - 2,
      left: 0,
      width: size,
      height: 4,
      borderRadius: 2,
      backgroundColor: RED,
      transform: `rotate(${deg}deg)`,
    });
  return h(
    "div",
    { position: "relative", display: "flex", width: size, height: size, flexShrink: 0 },
    bar(45),
    bar(-45),
  );
}

/** Marca ✓ dibujada (L rotada) */
function checkMark(brand: Brand, size = 30): El {
  return h(
    "div",
    { display: "flex", width: size, height: size, flexShrink: 0, alignItems: "center", justifyContent: "center" },
    h("div", {
      display: "flex",
      width: size * 0.85,
      height: size * 0.5,
      borderLeft: `5px solid ${brand.primary}`,
      borderBottom: `5px solid ${brand.primary}`,
      transform: "rotate(-45deg)",
      marginTop: -(size * 0.15),
    }),
  );
}

/** Pie de página: @handle (o sitio web si no hay Instagram) a la izquierda */
function footer(business: Business, extra?: Child): El {
  return h(
    "div",
    { display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" },
    h("div", { display: "flex", fontSize: 26, color: MUTED, fontWeight: 700 }, business.instagram || business.website),
    extra ?? h("div", { display: "flex" }),
  );
}

/** Raíz de slide: fondo negro + foto opcional + gradientes + contenido */
function slideRoot(children: Child[], photo?: string, gradients?: string[]): El {
  const layers: Child[] = [];
  if (photo) {
    layers.push(fullBleedPhoto(photo));
    for (const g of gradients ?? []) layers.push(overlay(g));
  }
  return h(
    "div",
    {
      position: "relative",
      display: "flex",
      flexDirection: "column",
      width: W,
      height: H,
      backgroundColor: BG,
      fontFamily: "Brand",
      color: "#FFFFFF",
    },
    ...layers,
    h(
      "div",
      {
        display: "flex",
        flexDirection: "column",
        width: W,
        height: H,
        padding: "64px 76px 56px 76px",
        justifyContent: "space-between",
      },
      ...children,
    ),
  );
}

/** Gradiente sutil de marca para slides sin foto */
function brandGlow(brand: Brand): string {
  return (
    `linear-gradient(150deg, ${rgba(brand.primary, 0.10)} 0%, ${rgba(brand.primary, 0)} 40%), ` +
    `linear-gradient(330deg, ${rgba(brand.accent, 0.07)} 0%, ${rgba(brand.accent, 0)} 36%)`
  );
}

function plainRoot(brand: Brand, children: Child[]): El {
  return h(
    "div",
    {
      position: "relative",
      display: "flex",
      flexDirection: "column",
      width: W,
      height: H,
      backgroundColor: BG,
      backgroundImage: brandGlow(brand),
      fontFamily: "Brand",
      color: "#FFFFFF",
      padding: "64px 76px 56px 76px",
      justifyContent: "space-between",
    },
    ...children,
  );
}

/* ── Portada ───────────────────────────────────────────────────────── */

function coverSlide(business: Business, brand: Brand, data: PremiumRenderData, photo?: string): El {
  const title = stripEmoji(data.title);
  const size = title.length > 44 ? 82 : title.length > 30 ? 94 : 106;

  const content: Child[] = [
    slideNumber(1, brand),
    h(
      "div",
      { display: "flex", flexDirection: "column", gap: 34, alignItems: "flex-start", maxWidth: photo ? 720 : 900 },
      titleWithDot(data.title, brand, {
        size,
        lineHeight: 1.18,
      }),
      data.hook
        ? h("div", { display: "flex", fontSize: 34, lineHeight: 1.45, color: BODY_COLOR, maxWidth: 640 }, stripEmoji(data.hook))
        : null,
    ),
    h(
      "div",
      { display: "flex", justifyContent: "space-between", alignItems: "flex-end", width: "100%" },
      logoPlate(business.slug, brand, 54),
      h(
        "div",
        { display: "flex", fontSize: 27, color: brand.primary, fontWeight: 700, letterSpacing: 3 },
        "DESLIZA →",
      ),
    ),
  ];

  if (photo) {
    return slideRoot(content, photo, [
      `linear-gradient(90deg, ${rgba(BG, 0.94)} 0%, ${rgba(BG, 0.72)} 38%, ${rgba(BG, 0.18)} 78%, ${rgba(BG, 0.42)} 100%)`,
      `linear-gradient(180deg, ${rgba(BG, 0.5)} 0%, ${rgba(BG, 0)} 26%, ${rgba(BG, 0)} 66%, ${rgba(BG, 0.72)} 100%)`,
    ]);
  }
  return plainRoot(brand, content);
}

/* ── Slides de contenido ───────────────────────────────────────────── */

function splitSlide(
  business: Business,
  brand: Brand,
  slide: IdeaSlide,
  n: number,
  photo?: string,
): El {
  const title = stripEmoji(slide.title);
  const titleSize = title.length > 42 ? 52 : 60;

  const content: Child[] = [
    slideNumber(n, brand),
    h(
      "div",
      { display: "flex", flexDirection: "column", gap: 30, alignItems: "flex-start", maxWidth: photo ? 580 : 880 },
      titleWithDot(slide.title, brand, {
        size: titleSize,
        lineHeight: 1.14,
      }),
      accentBar(brand),
      h(
        "div",
        { display: "flex", fontSize: 37, lineHeight: 1.55, color: BODY_COLOR },
        stripEmoji(slide.body),
      ),
    ),
    footer(business),
  ];

  if (photo) {
    return slideRoot(content, photo, [
      `linear-gradient(90deg, ${rgba(BG, 0.97)} 0%, ${rgba(BG, 0.9)} 42%, ${rgba(BG, 0.28)} 74%, ${rgba(BG, 0.15)} 100%)`,
      `linear-gradient(180deg, ${rgba(BG, 0.35)} 0%, ${rgba(BG, 0)} 22%, ${rgba(BG, 0)} 72%, ${rgba(BG, 0.6)} 100%)`,
    ]);
  }
  return plainRoot(brand, content);
}

function listSlide(business: Business, brand: Brand, slide: IdeaSlide, n: number): El {
  const bullets = (slide.bullets ?? []).slice(0, 5);
  return plainRoot(brand, [
    slideNumber(n, brand),
    h(
      "div",
      { display: "flex", flexDirection: "column", gap: 44, alignItems: "flex-start", width: "100%" },
      titleWithDot(slide.title, brand, {
        size: 58,
        lineHeight: 1.14,
      }),
      slide.body
        ? h("div", { display: "flex", fontSize: 32, lineHeight: 1.5, color: MUTED }, stripEmoji(slide.body))
        : null,
      h(
        "div",
        { display: "flex", flexDirection: "column", gap: 34, width: "100%" },
        bullets.map((b) =>
          h(
            "div",
            { display: "flex", gap: 26, alignItems: "center", width: "100%" },
            h("div", {
              display: "flex",
              width: 18,
              height: 18,
              borderRadius: 999,
              backgroundColor: brand.primary,
              flexShrink: 0,
            }),
            h("div", { display: "flex", fontSize: 37, lineHeight: 1.4, color: "#F2F4F6" }, stripEmoji(b)),
          ),
        ),
      ),
    ),
    footer(business),
  ]);
}

function statementSlide(business: Business, brand: Brand, slide: IdeaSlide, n: number): El {
  const title = stripEmoji(slide.title);
  const size = title.length > 60 ? 74 : title.length > 40 ? 84 : 96;
  return plainRoot(brand, [
    slideNumber(n, brand),
    h(
      "div",
      { display: "flex", flexDirection: "column", gap: 40, alignItems: "flex-start" },
      titleWithDot(slide.title, brand, {
        size,
        lineHeight: 1.12,
      }),
      slide.body
        ? h(
            "div",
            { display: "flex", flexDirection: "column", gap: 22, alignItems: "flex-start" },
            accentBar(brand, 72),
            h("div", { display: "flex", fontSize: 40, fontWeight: 700, color: brand.primary, lineHeight: 1.3 },
              stripEmoji(slide.body)),
          )
        : null,
    ),
    footer(business),
  ]);
}

function compareSlide(business: Business, brand: Brand, slide: IdeaSlide, n: number): El {
  const left = (slide.compareLeft ?? []).slice(0, 4);
  const right = (slide.compareRight ?? []).slice(0, 4);
  const row = (mark: El, text: string, color: string) =>
    h(
      "div",
      { display: "flex", gap: 22, alignItems: "flex-start", width: "100%" },
      mark,
      h("div", { display: "flex", fontSize: 31, lineHeight: 1.35, color }, stripEmoji(text)),
    );

  return plainRoot(brand, [
    slideNumber(n, brand),
    h(
      "div",
      { display: "flex", flexDirection: "column", gap: 52, width: "100%" },
      titleWithDot(slide.title, brand, {
        size: 54,
        lineHeight: 1.14,
      }),
      h(
        "div",
        { display: "flex", width: "100%", gap: 44 },
        h(
          "div",
          { display: "flex", flexDirection: "column", gap: 30, flex: 1 },
          h("div", { display: "flex", fontSize: 30, fontWeight: 700, color: MUTED, letterSpacing: 2, textTransform: "uppercase" },
            stripEmoji(slide.compareLeftLabel || "Selección tradicional")),
          left.map((t) => row(xMark(), t, BODY_COLOR)),
        ),
        h("div", { display: "flex", width: 1, backgroundColor: rgba("#C9CDD1", 0.22) }),
        h(
          "div",
          { display: "flex", flexDirection: "column", gap: 30, flex: 1 },
          h("div", { display: "flex", fontSize: 30, fontWeight: 700, color: brand.primary, letterSpacing: 2, textTransform: "uppercase" },
            stripEmoji(slide.compareRightLabel || business.name)),
          right.map((t) => row(checkMark(brand), t, "#F2F4F6")),
        ),
      ),
    ),
    footer(business),
  ]);
}

/* ── Cierre / CTA ──────────────────────────────────────────────────── */

function ctaSlide(business: Business, brand: Brand, n: number, photo?: string): El {
  const content: Child[] = [
    slideNumber(n, brand),
    h(
      "div",
      { display: "flex", flexDirection: "column", gap: 40, alignItems: "flex-start", maxWidth: 780, marginTop: "auto", marginBottom: 30 },
      logoPlate(business.slug, brand, 96),
      h("div", {
        display: "flex",
        fontSize: 28,
        color: "#C9CDD1",
        letterSpacing: 5,
        textTransform: "uppercase",
        fontWeight: 700,
      }, stripEmoji(business.tagline)),
      titleWithDot(business.ctaText, brand, {
        size: 64,
        lineHeight: 1.12,
      }),
      h(
        "div",
        {
          display: "flex",
          backgroundColor: brand.primary,
          color: "#0B0B0D",
          fontSize: 34,
          fontWeight: 700,
          padding: "24px 52px",
          borderRadius: 14,
          letterSpacing: 1,
          textTransform: "uppercase",
        },
        stripEmoji(brand.ctaButton || "Escríbenos"),
      ),
    ),
    h(
      "div",
      { display: "flex", gap: 40, alignItems: "center" },
      [business.instagram, business.website, business.phone]
        .filter(Boolean)
        .map((t, i) =>
          h(
            "div",
            { display: "flex", gap: 40, alignItems: "center" },
            i > 0
              ? h("div", { display: "flex", width: 8, height: 8, borderRadius: 999, backgroundColor: brand.primary })
              : null,
            h("div", { display: "flex", fontSize: 28, color: "#F2F4F6", fontWeight: 700 }, t),
          ),
        ),
    ),
  ];

  if (photo) {
    return slideRoot(content, photo, [
      `linear-gradient(180deg, ${rgba(BG, 0.35)} 0%, ${rgba(BG, 0.55) } 40%, ${rgba(BG, 0.9)} 72%, ${rgba(BG, 0.97)} 100%)`,
      `linear-gradient(90deg, ${rgba(BG, 0.5)} 0%, ${rgba(BG, 0)} 55%)`,
    ]);
  }
  return plainRoot(brand, content);
}

/* ── Armado del carrusel ───────────────────────────────────────────── */

/** Decide el layout efectivo de una slide según sus datos e imagen disponible */
export function effectiveLayout(slide: IdeaSlide, hasImage: boolean): SlideLayout {
  if (slide.layout === "compare" && slide.compareLeft?.length && slide.compareRight?.length) return "compare";
  if (slide.layout === "list" && slide.bullets?.length) return "list";
  if (slide.layout === "statement") return "statement";
  if (slide.layout === "split") return "split";
  // Sin layout declarado: split si hay imagen, lista si hay bullets, texto si no
  if (hasImage) return "split";
  if (slide.bullets?.length) return "list";
  return "split"; // split sin foto = panel de texto
}

export function buildPremiumCarouselSlides(
  business: Business,
  brand: Brand,
  data: PremiumRenderData,
  images: ResolvedImages,
): El[] {
  const content = data.slides.slice(0, 7);
  const els: El[] = [coverSlide(business, brand, data, images.cover)];

  content.forEach((slide, i) => {
    const img = images.slides[i];
    const n = i + 2;
    switch (effectiveLayout(slide, Boolean(img))) {
      case "compare":
        els.push(compareSlide(business, brand, slide, n));
        break;
      case "list":
        els.push(listSlide(business, brand, slide, n));
        break;
      case "statement":
        els.push(statementSlide(business, brand, slide, n));
        break;
      default:
        els.push(splitSlide(business, brand, slide, n, img));
    }
  });

  // Reutiliza la foto de portada en el CTA si no hay otra (queda elegante y no cuesta extra)
  els.push(ctaSlide(business, brand, content.length + 2, images.cover));
  return els;
}
