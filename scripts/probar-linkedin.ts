/**
 * Verifica que LinkedIn esté realmente listo para publicar, SIN publicar nada.
 *
 * Responde la pregunta que uno se hace cuando pega el token: "¿y ahora sí
 * funciona?". Revisa las tres cosas que pueden fallar por separado, para que el
 * error diga cuál es en vez de un HTTP a secas:
 *
 *   1. El token está vivo y con los permisos correctos (introspección).
 *   2. La versión de la API sigue vigente — una retirada devuelve 426, que no
 *      explica nada. Ya nos mordió: el código apuntaba a junio de 2025.
 *   3. La cuenta administra la página de empresa que dice administrar.
 *
 * Correr DESPUÉS de cargar data/credentials/reclutmatch.json con la sección
 * linkedin. No publica, no crea piezas, no toca la base.
 *
 *   npm run probar-linkedin
 */
import { loadCredentials } from "../lib/publish/credentials";

const API = "https://api.linkedin.com/rest";
const VERSION = process.env.LINKEDIN_VERSION || "202607";

const ok = (m: string) => console.log(`  ✔ ${m}`);
const mal = (m: string) => console.log(`  ✖ ${m}`);
const nota = (m: string) => console.log(`    ${m}`);

async function main() {
  const slug = process.argv[2] || "reclutmatch";
  const { linkedin } = loadCredentials(slug);

  console.log(`\nVerificando LinkedIn para "${slug}" (versión de API: ${VERSION})\n`);

  if (!linkedin) {
    mal("No hay sección `linkedin` en data/credentials/" + slug + ".json");
    nota("Todavía no está cargado. Formato esperado:");
    nota('{ "linkedin": { "organizationId": "...", "accessToken": "..." } }');
    process.exit(1);
  }

  const token = linkedin.accessToken?.trim();
  if (!token) {
    mal("Falta accessToken");
    process.exit(1);
  }
  ok(`accessToken presente (${token.length} caracteres)`);

  const author = linkedin.organizationId
    ? `urn:li:organization:${linkedin.organizationId}`
    : linkedin.personUrn || "";
  if (!author) {
    mal("Falta organizationId (o personUrn): no se sabe a nombre de quién publicar");
    process.exit(1);
  }
  ok(`publicaría como ${author}`);

  // --- 1. ¿El token está vivo y con qué permisos? ---
  // Requiere clientId/clientSecret; si no están, se salta sin dramatizar.
  console.log("\n1) Estado del token");
  const id = linkedin.clientId?.trim();
  const secret = linkedin.clientSecret?.trim();
  if (!id || !secret) {
    nota("(sin clientId/clientSecret no se puede introspeccionar — opcional)");
  } else {
    try {
      const r = await fetch("https://www.linkedin.com/oauth/v2/introspectToken", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ client_id: id, client_secret: secret, token }),
      });
      const j = (await r.json()) as {
        active?: boolean; status?: string; scope?: string; created_at?: number;
      };
      if (j.active) {
        ok(`token activo (estado: ${j.status ?? "active"})`);
        if (j.scope) {
          const scopes = j.scope.split(",").map((s) => s.trim());
          nota(`permisos: ${scopes.join(", ")}`);
          if (scopes.includes("w_organization_social")) ok("tiene w_organization_social (puede publicar como empresa)");
          else mal("FALTA w_organization_social — sin eso no puede publicar en la página");
        }
      } else {
        mal(`token NO activo (estado: ${j.status ?? "desconocido"}) — hay que renovarlo`);
      }
    } catch (e) {
      mal(`no se pudo introspeccionar: ${e instanceof Error ? e.message : e}`);
    }
  }

  // --- 2. ¿La versión de la API sigue vigente? ---
  console.log("\n2) Versión de la API");
  const h = {
    Authorization: `Bearer ${token}`,
    "LinkedIn-Version": VERSION,
    "X-Restli-Protocol-Version": "2.0.0",
  };
  try {
    const r = await fetch(`${API}/organizationAcls?q=roleAssignee&role=ADMINISTRATOR`, { headers: h });
    if (r.status === 426) {
      mal(`la versión ${VERSION} está DADA DE BAJA (HTTP 426)`);
      nota("Hay que subirla en lib/publish/linkedin.ts o poner LINKEDIN_VERSION en el .env.");
      nota("Tabla vigente: https://learn.microsoft.com/en-us/linkedin/marketing/versioning");
      process.exit(1);
    }
    if (r.status === 401 || r.status === 403) {
      mal(`la versión pasa, pero el token fue rechazado (HTTP ${r.status})`);
      nota((await r.text()).slice(0, 200));
      process.exit(1);
    }
    ok(`la versión ${VERSION} es aceptada (HTTP ${r.status})`);

    // --- 3. ¿Administra la página que dice administrar? ---
    console.log("\n3) Acceso a la página de empresa");
    const j = (await r.json()) as { elements?: { organization?: string }[] };
    const orgs = (j.elements ?? []).map((e) => e.organization).filter(Boolean) as string[];
    if (orgs.length === 0) {
      mal("la cuenta no administra ninguna página de empresa con este token");
      nota("Revisa que seas ADMIN de la página y que la app esté asociada a ella.");
      process.exit(1);
    }
    nota(`páginas que administra: ${orgs.join(", ")}`);
    if (linkedin.organizationId) {
      if (orgs.includes(author)) ok(`${author} está en la lista — puede publicar ahí`);
      else {
        mal(`${author} NO está entre las páginas que administra`);
        nota("El organizationId del JSON no calza con los permisos del token.");
        process.exit(1);
      }
    }
  } catch (e) {
    mal(`fallo de red o respuesta inesperada: ${e instanceof Error ? e.message : e}`);
    process.exit(1);
  }

  console.log("\n✅ LinkedIn está listo. La próxima pieza aprobada se publica sola.\n");
}

main().catch((e) => {
  console.error("ERROR:", e instanceof Error ? e.message : e);
  process.exit(1);
});
