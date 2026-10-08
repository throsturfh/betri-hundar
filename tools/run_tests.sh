#!/bin/sh
# Serves the built game on a free port (never 8765) and runs both playwright tests.
cd "$(dirname "$0")/.." || exit 1
PORT=$(python3 -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1",0)); p=s.getsockname()[1]; s.close(); print(p if p != 8765 else 8932)')
mkdir -p screenshots/v2 screenshots/v2_boards
python3 -m http.server "$PORT" --bind 127.0.0.1 >/dev/null 2>&1 & SRV=$!
sleep 0.8
PY=/workspace/.venv-pw/bin/python
$PY tools/test_play.py "http://127.0.0.1:$PORT/index.html"; A=$?
$PY tools/test_more.py "http://127.0.0.1:$PORT/index.html"; B=$?
kill $SRV
echo "test_play exit=$A test_more exit=$B (port $PORT)"
[ $A -eq 0 ] && [ $B -eq 0 ]
