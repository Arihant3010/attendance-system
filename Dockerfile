FROM node:20-bookworm

WORKDIR /app

COPY package*.json ./

RUN npm install && npm rebuild sqlite3 --build-from-source

COPY . .

EXPOSE 5000

CMD ["node", "server.js"]
