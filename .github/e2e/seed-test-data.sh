#!/usr/bin/env bash
# Seeds the test data the Playwright tests rely on: the known customers, the
# security questions and the extra product image. Run once the stack is up.
#
# Usage: COMPOSE_FILES="-f ... -f ..." .github/e2e/seed-test-data.sh
set -euo pipefail

API_URL="${API_URL:-http://localhost:3000}"
SQL_FILE="$(dirname "$0")/seed-test-data.sql"

# shellcheck disable=SC2086
docker compose $COMPOSE_FILES exec -T db \
  psql -v ON_ERROR_STOP=1 -U "${POSTGRES_USER:-dev}" -d "${POSTGRES_DB:-app_dev}" < "$SQL_FILE"

# Customers are created through the API so the password is hashed by the backend.
# 202 means created, 400 means the email is already registered.
register() {
  status=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$API_URL/api/v1/auth/register" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$1\",\"password\":\"$2\"}")
  if [ "$status" != "202" ] && [ "$status" != "400" ]; then
    echo "Registering $1 failed with HTTP $status" >&2
    exit 1
  fi
}

register john@test.com testPassword
register john@test2.com testPassword
