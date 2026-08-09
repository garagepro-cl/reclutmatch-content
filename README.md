# ContentPilot — ReclutMatch 🎯

Genera **carruseles** para las redes de **ReclutMatch**, te los manda a
**Telegram para aprobar**, y los **publica automáticamente** en Instagram
y LinkedIn (página de empresa, como documento PDF).

## Cómo funciona el día a día

```
Lunes / Miércoles / Viernes a las 09:00 (automático)
   ↓
1. Se genera una idea (IA o banco de ideas incorporado)
   Pilares: fit empresarial · errores de contratación · educación en
   selección · producto ReclutMatch · tendencias RRHH Chile
2. Se produce el diseño con la marca (violeta #8840F8 / marino #181048):
   · Carrusel → imágenes 1080×1350 + PDF para LinkedIn
3. Te llega a Telegram con botones:  ✅ Aprobar · 🔄 Otra · ❌ Descartar
4. Al aprobar, se publica en las plataformas configuradas
   (sin credenciales → queda "Manual": archivos + caption listos, y el
   PDF de LinkedIn llega por Telegram para subirlo a mano)
```

Todo también se puede hacer desde el dashboard web.

## Arrancar

```bash
cd C:\Users\Rodrigo\Projects\reclutmatch-content
npm run dev          # abre http://localhost:3000
```

Contraseña del panel: variable `ADMIN_PASSWORD` en `.env`.

El servidor levanta a la vez: el dashboard, el bot de Telegram y el scheduler.
Si el PC estaba apagado a las 09:00 de un día programado, genera el contenido
apenas arranques la app ese día (catch-up automático).

## Comandos útiles

| Comando | Qué hace |
|---|---|
| `npm run dev` | Arranca todo (dashboard + bot + scheduler) |
| `npm run generate` | Genera una pieza ahora mismo |
| `npm run seed` | Crea/actualiza el negocio base |
| `npm run db:push` | Aplica cambios del esquema de base de datos |
| `npx tsx scripts/test-premium.ts` | Prueba visual de todos los layouts (sin gastar IA) |

---

# Configuración (en orden de impacto)

## 1. Telegram — aprobar desde el celular (5 minutos, gratis)

1. En Telegram habla con **@BotFather** → `/newbot` → dale un nombre (ej: `ReclutMatch Content`).
2. Copia el token que te da y pégalo en `.env`:
   ```
   TELEGRAM_BOT_TOKEN=123456789:AAF...
   ```
3. Reinicia la app (`npm run dev`) y envíale **/start** a tu bot.
   Tu chat queda registrado y ahí llegarán las previsualizaciones.

Comandos del bot: `/generar` (todo), `/generar reclutmatch`, `/id`.

## 2. Ideas con IA (ya configurado)

`ANTHROPIC_API_KEY` viene en el `.env` (la misma cuenta de ContentPilot
Garage Pro). Sin la key, la app usa el **banco de 6 ideas incorporado**.
Modelo configurable con `ANTHROPIC_MODEL`.

Las imágenes de los slides se generan con **Kie.ai** (`KIE_API_KEY`,
~US$0,02-0,07 por imagen, máx 4 por carrusel). Sin key, los slides
degradan a layout tipográfico elegante.

## 3. LinkedIn — página de empresa (carruseles como documento PDF)

**Contexto**: la página de ReclutMatch la administra **Andrea**. Para la
API se necesita que un admin de la página apruebe la app.

1. Entra a https://developer.linkedin.com → **Create app**:
   - Asóciala a la **página de empresa ReclutMatch** (pide verificación:
     LinkedIn le manda un enlace de aprobación al admin de la página).
2. En la app → pestaña **Products** → solicita **Community Management API**
   (este es el paso que puede tardar días/semanas en aprobarse).
3. Aprobado el producto, genera un token OAuth con scope
   `w_organization_social` (puedes usar el **Token Generator** del portal,
   iniciando sesión con la cuenta admin de la página).
4. El id de la organización: está en la URL de la página de empresa
   (`linkedin.com/company/<id-o-nombre>`) o vía API `GET /rest/organizationAcls?q=roleAssignee`.
5. Crea `data/credentials/reclutmatch.json`:
   ```json
   {
     "linkedin": {
       "organizationId": "123456789",
       "accessToken": "AQV..."
     }
   }
   ```

**Mientras no esté aprobado**: al aprobar una pieza, el bot de Telegram te
manda el **PDF listo** — publicarlo a mano en LinkedIn toma 1 minuto
(botón "+" → Agregar documento).

**Nota**: los tokens de LinkedIn duran ~60 días (365 con refresh token
programático). Si la publicación falla con error 401, hay que regenerar el
token. La versión de API se fija con `LINKEDIN_VERSION` en `.env` (formato
`AAAAMM`, por defecto `202506`).

## 4. Instagram (cuando exista la cuenta)

**Requisitos**: cuenta de Instagram **Business** vinculada a una
**página de Facebook** de ReclutMatch.

1. Entra a https://developers.facebook.com → **Crear app** → tipo **Business**.
2. En la app: **Herramientas → Explorador de la API Graph**:
   - Permisos: `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`,
     `instagram_basic`, `instagram_content_publish`, `business_management`.
   - **Generar token de acceso** con la cuenta dueña de la página.
3. Con ese token consulta `GET /me/accounts` → copia el **`access_token`
   de la página** (no expira si derivas de un token de usuario extendido)
   y el **`id`** (pageId).
4. El id de Instagram: `GET /{pageId}?fields=instagram_business_account`.
5. Agrega a `data/credentials/reclutmatch.json`:
   ```json
   {
     "meta": {
       "pageId": "1234567890",
       "igUserId": "17840000000000000",
       "accessToken": "EAAG..."
     }
   }
   ```

**Nota Instagram**: la API de IG exige que las imágenes estén en una
**URL pública** → `PUBLIC_BASE_URL` en `.env`. Funciona al desplegar en el
droplet (content.reclutmatch.cl). Mientras tanto queda en modo manual.

---

# Despliegue previsto (droplet DigitalOcean de Garage Pro)

- Mismo droplet que ContentPilot (147.182.218.218), como **segundo servicio
  systemd** en otro puerto, con nginx y el subdominio `content.reclutmatch.cl`
  (registro DNS A → 147.182.218.218, se agrega en el panel del hosting de
  reclutmatch.cl).
- `PUBLIC_BASE_URL=https://content.reclutmatch.cl` en el `.env` del droplet.

# Estructura

```
app/                → dashboard web (Next.js)
lib/ideas/          → banco de ideas + generación con IA (prompt RRHH Chile)
lib/render/         → plantillas premium violeta/marino (satori + FFmpeg)
lib/publish/        → publicadores IG / FB / LinkedIn / YT + credenciales
lib/telegram.ts     → bot de aprobación (+ envío del PDF de LinkedIn)
lib/scheduler.ts    → generación programada (lun/mié/vie 09:00 Chile)
assets/brands/      → logo ReclutMatch (logo.png + logo-trim.png)
data/app.db         → base de datos (SQLite)
data/output/        → imágenes y PDFs generados
data/credentials/   → credenciales por negocio (fuera de git)
```

# Problemas comunes

- **No llega nada a Telegram** → ¿le enviaste `/start` al bot? ¿está corriendo `npm run dev`?
- **"LinkedIn no configurado"** → normal mientras no esté la app aprobada; el PDF llega por Telegram.
- **"Instagram requiere PUBLIC_BASE_URL"** → limitación de la API de IG; se resuelve al desplegar.
- **Cambié el logo y no se nota** → reinicia la app (el logo se cachea en memoria).
- **Quiero cambiar horario/días** → `SCHEDULE_CRON` en `.env` (formato cron) y reinicia.
