#!/bin/sh
# Run the 6.07 migration against a throwaway local Postgres. Does not touch any hosted database.
set -eu
PG="${PG:-/usr/lib/postgresql/16/bin}"
ROOT="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
DATA="${TMPDIR:-/tmp}/bh-guard-pg"
PORT="${BH_PG_PORT:-5433}"
rm -rf "$DATA"
"$PG/initdb" -D "$DATA" -U bh --auth=trust >/tmp/bh-guard-init.log
"$PG/pg_ctl" -D "$DATA" -l /tmp/bh-guard.log -o "-p $PORT -k /tmp" start
cleanup() { "$PG/pg_ctl" -D "$DATA" -m fast stop >/dev/null 2>&1 || true; }
trap cleanup EXIT
"$PG/createdb" -h /tmp -p "$PORT" -U bh bhguard
"$PG/psql" -h /tmp -p "$PORT" -U bh -d bhguard -v ON_ERROR_STOP=1 -f "$ROOT/tools/test_bh_guard_sql.sql"
echo "bh_guard sql tests ok"
