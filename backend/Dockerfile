# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Production
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV TZ=Asia/Ho_Chi_Minh
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
# Phông Noto Sans cho PDF bản hợp đồng đã ký (FE-49); buildContractPdf đọc ./assets/fonts
COPY --from=builder /app/assets ./assets
EXPOSE 8081
CMD ["node", "dist/main"]
