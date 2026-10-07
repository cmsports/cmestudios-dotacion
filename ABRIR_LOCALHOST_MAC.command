#!/bin/bash
cd -- "$(dirname -- "$0")" || exit 1
if command -v python3 >/dev/null 2>&1; then
    python3 iniciar_demo.py --open
else
    echo "Necesitas Python 3 para iniciar esta demo. Instala Python desde python.org."
fi
read -r -p "Pulsa Enter para cerrar. "
