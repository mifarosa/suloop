# suloop sunucusu. Depo kökünden derlenir; böylece sunucu, oyunun kendi kurallarını (src/game)
# birebir aynı kodla kullanır:
#   docker build -f server/Dockerfile -t suloop-server .
FROM node:22-slim

WORKDIR /app

# Oyunun kodu ES modülü; kökteki package.json bunu /app/src için işaretler.
COPY package.json ./package.json
COPY src ./src

COPY server/package.json server/package-lock.json ./server/
RUN cd server && npm ci --omit=dev

COPY server/src ./server/src

# Veri (SQLite dosyası ve yedekler) /data'da durur; compose buraya bir volume bağlar.
RUN mkdir /data && chown node:node /data
ENV NODE_ENV=production DATA_DIR=/data PORT=3000
USER node

WORKDIR /app/server
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "--disable-warning=ExperimentalWarning", "src/index.js"]
