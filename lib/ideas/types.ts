/** Layout visual de una slide de contenido (estilo referencia Garage Pro) */
export type SlideLayout = "split" | "list" | "statement" | "compare";

export interface IdeaSlide {
  title: string;
  body: string;
  /** Layout visual; si falta, se infiere (split con foto, texto sin ella) */
  layout?: SlideLayout;
  /** Para layout "list": 3-4 puntos cortos (reemplazan al body) */
  bullets?: string[];
  /** Para layout "compare": columna izquierda (lo malo, con ✗) */
  compareLeft?: string[];
  compareLeftLabel?: string;
  /** Para layout "compare": columna derecha (lo bueno, con ✓) */
  compareRight?: string[];
  compareRightLabel?: string;
  /** Descripción EN INGLÉS de la foto ideal para esta slide (para generar con IA) */
  imagePrompt?: string;
  /** Archivo de la biblioteca de fotos reales (assets/photos/<slug>/) si alguno calza */
  photo?: string;
}

export interface Idea {
  /** Pilar de contenido al que pertenece */
  pillar: string;
  /** CAROUSEL, VIDEO o ANY (sirve para ambos) */
  type: "CAROUSEL" | "VIDEO" | "ANY";
  /** Título interno / gancho principal de la portada */
  title: string;
  /** Frase de apoyo bajo el título en la portada */
  hook: string;
  slides: IdeaSlide[];
  caption: string;
  hashtags: string[];
  /** Descripción EN INGLÉS de la imagen de portada (para generar con IA) */
  coverImagePrompt?: string;
  /** Foto real de la biblioteca para la portada, si alguna calza */
  coverPhoto?: string;
}
