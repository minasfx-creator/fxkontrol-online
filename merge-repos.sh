#!/bin/bash

# Script para mesclar dois repositórios Git
# Destino: fxkontrol-online-3d069efd
# Origem: fxkontrol-online

set -e  # Para na primeira falha

echo "🚀 Iniciando merge dos repositórios..."

# Clone destino
echo "📥 Clonando repositório de destino..."
git clone https://github.com/minasfx-creator/fxkontrol-online-3d069efd.git
cd fxkontrol-online-3d069efd

# Adiciona origem como remote
echo "🔗 Adicionando repositório de origem..."
git remote add origin-repo https://github.com/minasfx-creator/fxkontrol-online.git

# Fetch do repositório de origem
echo "📡 Buscando dados do repositório de origem..."
git fetch origin-repo

# Merge com históricos não relacionados
echo "🔀 Iniciando merge..."
git merge --allow-unrelated-histories origin-repo/main -m "Merge: Integração do fxkontrol-online"

# Push para o GitHub
echo "📤 Enviando para GitHub..."
git push origin main

echo "✅ Merge concluído com sucesso!"
echo "📍 Repositório de destino: https://github.com/minasfx-creator/fxkontrol-online-3d069efd"
