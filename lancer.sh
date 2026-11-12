#!/bin/sh
# Lance KamasUltra en local (Linux / macOS) : ouvre http://127.0.0.1:8765/ (aussi accessible depuis le réseau local)
cd "$(dirname "$0")" && exec python3 serveur.py "$@"
