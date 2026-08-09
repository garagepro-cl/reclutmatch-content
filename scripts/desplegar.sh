#!/bin/bash
# Despliega ContentPilot en el servidor trayendo el codigo desde GitHub.
#
# Reemplaza al despliegue por tarball (git archive + tar x), que dejaba al
# servidor sin saber de donde venian sus archivos: la deriva era invisible y
# asi ReclutMatch acumulo 24 archivos divergentes sin que nadie lo notara.
#
# Uso, DENTRO del servidor:  bash scripts/desplegar.sh
# Desde el notebook:         ssh root@147.182.218.218 'cd /opt/reclutmatch-content && bash scripts/desplegar.sh'
#
# Antes de correrlo hay que haber hecho push a GitHub desde el notebook.
set -euo pipefail

PROY=$(basename "$PWD")
SERVICIO="${SERVICIO:-reclutmatch-content.service}"
PUERTO="${PUERTO:-3001}"
STAMP=$(date +%F_%H%M%S)
RESPALDO="/opt/backups-erp/${PROY}_${STAMP}"

echo "▶ Desplegando $PROY"

# --- 1. Respaldo antes de tocar nada (regla 1) ---
mkdir -p "$RESPALDO"
tar czf "$RESPALDO/codigo.tgz" --exclude=./node_modules --exclude=./.next --exclude=./data/output .
[ -f data/app.db ] && cp data/app.db "$RESPALDO/app.db"
echo "  ✔ respaldo en $RESPALDO"

# --- 2. Avisar si alguien edito a mano: se perderia con el reset ---
if [ -n "$(sudo -u contentpilot git status --porcelain)" ]; then
  echo "  ⚠ HAY CAMBIOS SIN REGISTRAR EN EL SERVIDOR:"
  sudo -u contentpilot git status --porcelain | sed 's/^/      /'
  echo "  Estan guardados en el respaldo. Si sirven, hay que llevarlos al repo"
  echo "  antes de seguir. Para desplegar igual y descartarlos: FORZAR=1 bash scripts/desplegar.sh"
  [ "${FORZAR:-0}" = "1" ] || exit 1
fi

# --- 3. Traer el codigo ---
ANTES=$(sudo -u contentpilot git rev-parse HEAD)
sudo -u contentpilot git fetch -q origin
sudo -u contentpilot git reset --hard -q origin/main
DESPUES=$(sudo -u contentpilot git rev-parse HEAD)

if [ "$ANTES" = "$DESPUES" ]; then
  echo "  ℹ ya estaba al dia ($(sudo -u contentpilot git log --oneline -1))"
else
  echo "  ✔ actualizado:"
  sudo -u contentpilot git log --oneline "$ANTES..$DESPUES" | sed 's/^/      /'
fi

# --- 4. Dependencias, solo si cambiaron ---
if ! sudo -u contentpilot git diff --quiet "$ANTES" "$DESPUES" -- package-lock.json 2>/dev/null; then
  echo "  ▶ package-lock.json cambio, instalando…"
  # Sin --omit=dev: en este servidor los timers corren con tsx, que es
  # devDependency. Podarlas deja todos los timers rotos.
  sudo -u contentpilot npm install --silent
fi

# --- 5. Esquema, solo si cambio ---
if ! sudo -u contentpilot git diff --quiet "$ANTES" "$DESPUES" -- prisma/schema.prisma 2>/dev/null; then
  echo "  ▶ el esquema cambio, aplicando…"
  sudo -u contentpilot npx prisma db push --skip-generate
  sudo -u contentpilot npx prisma generate
fi

# --- 6. Compilar y reiniciar ---
echo "  ▶ compilando…"
sudo -u contentpilot npm run build > /tmp/deploy-build.log 2>&1 || {
  echo "  ✖ FALLO LA COMPILACION — el servicio sigue con la version anterior:"
  tail -20 /tmp/deploy-build.log | sed 's/^/      /'
  exit 1
}
systemctl restart "$SERVICIO"
sleep 6

# --- 7. Verificar de verdad, no asumir ---
ESTADO=$(systemctl is-active "$SERVICIO")
HTTP=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PUERTO/login" || echo "000")
ERRORES=$(journalctl -u "$SERVICIO" --since "1 min ago" --no-pager -p err 2>/dev/null | grep -vc "^--" || true)

echo "  servicio: $ESTADO | /login: HTTP $HTTP | errores en el journal: $ERRORES"
if [ "$ESTADO" != "active" ] || [ "$HTTP" != "200" ]; then
  echo "  ✖ ALGO QUEDO MAL. Respaldo en $RESPALDO"
  exit 1
fi
echo "▶ Listo: $PROY en $(sudo -u contentpilot git log --oneline -1)"
