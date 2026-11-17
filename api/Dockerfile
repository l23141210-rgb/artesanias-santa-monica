FROM node:20-alpine
WORKDIR /app
COPY server.js .
RUN mkdir /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 3000
CMD ["node", "server.js"]
