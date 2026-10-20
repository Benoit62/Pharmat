# Pharmat — image de production (template/dockerfiles/node du dépôt Infra).
FROM node:24-alpine

WORKDIR /app
ENV NODE_ENV=production

# Les dépendances d'abord : une couche qui ne change que si package*.json change
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY serveur.js ./
COPY src ./src
COPY vues ./vues
COPY public ./public
COPY migrations ./migrations
COPY outils/migrer.js ./outils/migrer.js

# Jamais root dans le conteneur : l'utilisateur « node » est fourni par l'image
USER node
EXPOSE 3000
CMD ["node", "serveur.js"]
