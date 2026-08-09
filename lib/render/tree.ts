/**
 * Mini-helper para construir árboles de elementos que satori entiende,
 * sin necesitar JSX/React en módulos de servidor.
 */
export interface El {
  type: string;
  props: Record<string, unknown>;
}

export type Child = El | string | number | null | undefined | false | Child[];

function flatten(children: Child[], out: (El | string | number)[] = []): (El | string | number)[] {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) flatten(c, out);
    else out.push(c);
  }
  return out;
}

export function h(
  type: string,
  style: Record<string, unknown> = {},
  ...children: Child[]
): El {
  const flat = flatten(children);
  return {
    type,
    props: {
      style,
      children: flat.length === 0 ? undefined : flat.length === 1 ? flat[0] : flat,
    },
  };
}

export function img(
  src: string,
  width: number,
  height: number,
  style: Record<string, unknown> = {},
): El {
  return { type: "img", props: { src, width, height, style } };
}

/** Convierte #RRGGBB a rgba() con alpha */
export function rgba(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/** Quita emojis (satori no los renderiza sin fuente de emoji) */
export function stripEmoji(text: string): string {
  return text
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}]/gu, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}
