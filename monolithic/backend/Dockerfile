FROM node:20-alpine AS deps

WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev

FROM node:20-alpine

WORKDIR /app

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
COPY src ./src

RUN chown -R appuser:appgroup /app
USER appuser

EXPOSE 4000
CMD ["npm", "start"]
