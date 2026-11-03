# ---- Etapa 1: build ----
# Usamos uma imagem com Node só para instalar dependências e gerar os
# arquivos estáticos finais (pasta /dist). Essa imagem não vai pro container final.
FROM node:20-alpine AS build

WORKDIR /app

# Copiamos primeiro só os arquivos de dependência para aproveitar o cache do
# Docker: se o package.json não mudar, o Docker não reinstala tudo de novo.
COPY package.json package-lock.json* ./
RUN npm install

# Agora copiamos o resto do código e geramos o build de produção.
COPY . .

# Permite definir a URL da API no momento do build, se necessário.
# Ex: docker build --build-arg VITE_API_URL=https://minha-api.com .
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# ---- Etapa 2: servidor final ----
# Imagem bem mais leve, só com Nginx pra servir os arquivos estáticos gerados.
FROM nginx:alpine

# Configuração customizada pra rotas do React Router funcionarem
# (sem isso, recarregar a página em "/login" daria erro 404).
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copia apenas o resultado do build da etapa anterior, nada de node_modules.
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
