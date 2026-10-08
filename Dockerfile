# Node 20 Bookworm (Debian 12) mein modern GLIBC 2.38 support natively hota hai
FROM node:20-bookworm

WORKDIR /app

COPY package*.json ./

# Source se rebuild force karein taaki Linux C libraries properly match ho jayein
RUN npm install && npm rebuild sqlite3 --build-from-source

COPY . .

EXPOSE 5000

CMD ["node", "server.js"]