/**
 * Obtiene el refresh token de YouTube para un negocio.
 *
 * Requisitos previos (una vez, en https://console.cloud.google.com):
 *  1. Crear proyecto → habilitar "YouTube Data API v3"
 *  2. Pantalla de consentimiento OAuth (tipo Externo, usuario de prueba: tu Gmail)
 *  3. Credenciales → ID de cliente OAuth → tipo "Aplicación de escritorio"
 *  4. Copiar clientId y clientSecret a data/credentials/<slug>.json:
 *     { "youtube": { "clientId": "...", "clientSecret": "..." } }
 *
 * Uso: npm run yt:auth -- garage-pro
 */
import http from "node:http";
import { google } from "googleapis";
import { loadCredentials, saveCredentials } from "../lib/publish/credentials";

const PORT = 8484;

async function main() {
  const slug = process.argv[2];
  if (!slug) {
    console.error("Uso: npm run yt:auth -- <slug-del-negocio>");
    process.exit(1);
  }

  const creds = loadCredentials(slug);
  if (!creds.youtube?.clientId || !creds.youtube?.clientSecret) {
    console.error(
      `Falta clientId/clientSecret en data/credentials/${slug}.json\n` +
      `Crea el archivo con: { "youtube": { "clientId": "...", "clientSecret": "..." } }\n` +
      `(instrucciones completas en el README, sección YouTube)`,
    );
    process.exit(1);
  }

  const oauth2 = new google.auth.OAuth2(
    creds.youtube.clientId,
    creds.youtube.clientSecret,
    `http://localhost:${PORT}/callback`,
  );

  const authUrl = oauth2.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["https://www.googleapis.com/auth/youtube.upload"],
  });

  console.log("\n1. Abre esta URL en tu navegador (con la cuenta de Google del canal):\n");
  console.log(authUrl);
  console.log("\n2. Autoriza el acceso. Esta ventana esperará la respuesta…\n");

  const code = await new Promise<string>((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
      if (url.pathname !== "/callback") { res.writeHead(404); res.end(); return; }
      const c = url.searchParams.get("code");
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end("<h2>✅ Listo. Puedes cerrar esta pestaña y volver a la terminal.</h2>");
      server.close();
      if (c) resolve(c);
      else reject(new Error("Google no devolvió el código de autorización"));
    });
    server.listen(PORT);
  });

  const { tokens } = await oauth2.getToken(code);
  if (!tokens.refresh_token) {
    throw new Error("No llegó refresh_token. Repite el proceso (el prompt=consent debería forzarlo).");
  }

  saveCredentials(slug, {
    ...creds,
    youtube: { ...creds.youtube, refreshToken: tokens.refresh_token },
  });
  console.log(`✔ Refresh token guardado en data/credentials/${slug}.json`);
  console.log("YouTube quedó listo para publicar automáticamente.");
}

main().catch((e) => { console.error(e); process.exit(1); });
