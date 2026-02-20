#!/bin/bash
# ================================================================
# Setup VPS crontab for Assiny background jobs
# Replaces the in-process Node.js scheduler with reliable OS cron
#
# Usage: bash scripts/setup-cron.sh
# ================================================================

set -e

APP_DIR="/var/www/assiny"
LOG_DIR="${APP_DIR}/logs"
ENV_FILE="${APP_DIR}/.env.local"

# Read CRON_SECRET from .env.local
if [ -f "$ENV_FILE" ]; then
  CRON_SECRET=$(grep '^CRON_SECRET=' "$ENV_FILE" | cut -d'=' -f2- | tr -d '"' | tr -d "'")
fi

if [ -z "$CRON_SECRET" ]; then
  echo "⚠ CRON_SECRET not found in ${ENV_FILE}"
  echo "  Add CRON_SECRET=your_secret to .env.local"
  exit 1
fi

APP_URL=$(grep '^NEXT_PUBLIC_APP_URL=' "$ENV_FILE" | cut -d'=' -f2- | tr -d '"' | tr -d "'" || echo "")
if [ -z "$APP_URL" ]; then
  APP_URL=$(grep '^NEXT_PUBLIC_SITE_URL=' "$ENV_FILE" | cut -d'=' -f2- | tr -d '"' | tr -d "'" || echo "https://ramppy.site")
fi

# Create log directory
mkdir -p "$LOG_DIR"

echo "Setting up Assiny cron jobs..."
echo "  APP_URL: ${APP_URL}"
echo "  LOG_DIR: ${LOG_DIR}"

# Build cron entries
CRON_ENTRIES=$(cat <<CRON
# ================================================================
# Assiny Background Jobs
# ================================================================

# Auto-schedule bots for meetings starting within 5 minutes (every 2 min)
*/2 * * * * curl -s -X POST "${APP_URL}/api/calendar/auto-schedule" -H "x-cron-secret: ${CRON_SECRET}" -H "Content-Type: application/json" >> ${LOG_DIR}/cron.log 2>&1

# Sync Google Calendar events (every 15 min)
*/15 * * * * curl -s -X POST "${APP_URL}/api/calendar/auto-schedule?action=sync" -H "x-cron-secret: ${CRON_SECRET}" -H "Content-Type: application/json" >> ${LOG_DIR}/cron.log 2>&1

# Generate daily challenges (once per day at 00:30)
30 0 * * * curl -s -X POST "${APP_URL}/api/challenges/generate-all" -H "x-cron-secret: ${CRON_SECRET}" -H "Content-Type: application/json" >> ${LOG_DIR}/cron.log 2>&1

CRON
)

# Remove old Assiny cron entries (if any)
crontab -l 2>/dev/null | grep -v "# Assiny Background Jobs" | grep -v "auto-schedule" | grep -v "challenges/generate-all" | grep -v "^$" > /tmp/cron_clean 2>/dev/null || true

# Append new entries
echo "" >> /tmp/cron_clean
echo "$CRON_ENTRIES" >> /tmp/cron_clean

# Install
crontab /tmp/cron_clean
rm /tmp/cron_clean

echo ""
echo "Cron jobs installed successfully!"
echo ""
echo "Verify with: crontab -l"
echo "Logs at: ${LOG_DIR}/cron.log"
echo ""
echo "IMPORTANT: Set DISABLE_INTERNAL_SCHEDULER=true in .env.local and restart PM2"
