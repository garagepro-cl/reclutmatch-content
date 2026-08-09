import fs from "node:fs";
import path from "node:path";
import { google } from "googleapis";
import type { Business, ContentPiece } from "@prisma/client";
import { loadCredentials } from "./credentials";
import type { PublishOutcome } from "./types";

/** Sube el video como YouTube Short (vertical <3 min se detecta solo) */
export async function publishYouTube(
  business: Business,
  piece: ContentPiece,
  outDir: string,
): Promise<PublishOutcome> {
  const { youtube: creds } = loadCredentials(business.slug);
  if (!creds?.clientId || !creds?.clientSecret || !creds?.refreshToken) {
    return {
      status: "MANUAL_REQUIRED",
      error:
        "YouTube no configurado: ejecuta `npm run yt:auth -- " + business.slug +
        "` después de crear las credenciales OAuth en Google Cloud (ver README)",
    };
  }

  try {
    const oauth2 = new google.auth.OAuth2(creds.clientId, creds.clientSecret);
    oauth2.setCredentials({ refresh_token: creds.refreshToken });
    const yt = google.youtube({ version: "v3", auth: oauth2 });

    const description = [piece.caption, piece.hashtags].filter(Boolean).join("\n\n");
    const res = await yt.videos.insert({
      part: ["snippet", "status"],
      requestBody: {
        snippet: {
          title: `${piece.title} #Shorts`.slice(0, 100),
          description: description.slice(0, 4900),
          categoryId: "2", // Autos & Vehicles
        },
        status: { privacyStatus: "public", selfDeclaredMadeForKids: false },
      },
      media: { body: fs.createReadStream(path.join(outDir, piece.videoPath)) },
    });

    const id = res.data.id!;
    return { status: "PUBLISHED", externalId: id, permalink: `https://youtube.com/shorts/${id}` };
  } catch (err) {
    return { status: "FAILED", error: err instanceof Error ? err.message : String(err) };
  }
}
