#!/bin/bash
# Double-click in Finder. Stops whatever Wandel server is already running (port 4320),
# then starts `npm run dev:local`, which rebuilds, restarts and pushes after every change.
cd "$(dirname "$0")" || exit 1
old=$(lsof -ti tcp:4320 2>/dev/null)
if [ -n "$old" ]; then echo "Stopping the old Wandel server ($old)…"; kill $old 2>/dev/null; sleep 2; kill -9 $old 2>/dev/null; fi
echo "Starting Wandel (leave this window open)…"
exec npm run dev:local
