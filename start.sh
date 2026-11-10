#!/usr/bin/env bash
# Inicia a aplicação Calculadora GCP sem precisar de npm/node em execução

PORT=3000
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/dist"

if [ ! -d "$DIR" ]; then
  echo "Diretório dist/ não encontrado. Por favor, execute 'npm run build' uma vez para gerar os arquivos estáticos."
  exit 1
fi

echo "🚀 Iniciando servidor estático em http://localhost:$PORT..."
echo "Pressione Ctrl+C para encerrar."

# Tenta abrir o navegador automaticamente
(sleep 1 && (xdg-open "http://localhost:$PORT" 2>/dev/null || open "http://localhost:$PORT" 2>/dev/null)) &

# Executa servidor nativo do Python 3
python3 -m http.server "$PORT" --directory "$DIR"
