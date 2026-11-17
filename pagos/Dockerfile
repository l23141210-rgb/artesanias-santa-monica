FROM node:20-alpine
WORKDIR /app
COPY package.json .
RUN npm install --omit=dev
COPY server.js .
RUN mkdir /data && chown node:node /data
USER node
EXPOSE 4000
CMD ["node", "server.js"]