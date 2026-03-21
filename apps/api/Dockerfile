FROM node:20-alpine
WORKDIR /app
COPY apps/api/package*.json ./
RUN npm install
COPY apps/api/ .
EXPOSE 3000
CMD ["sh", "-c", "npx drizzle-kit migrate && npm start"]
