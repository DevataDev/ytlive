# 1. Use official Node image
FROM node:18-alpine AS builder

# 3. Set env for production
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_API_BASE_URL

ENV NODE_ENV=production \
    NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL

# 2. Set working directory
WORKDIR /app

# 3. Install deps
COPY package*.json ./
COPY tsconfig.json ./

RUN npm install

# 4. Copy source
COPY . .

RUN ls -R src/services

# 5. Build the Next.js app
RUN npm run build

# --- Final stage: run optimized production build ---
FROM node:18-alpine AS runner

# 6. Set working directory
WORKDIR /app

# 7. Copy built app + node_modules from builder
COPY --from=builder /app ./

# 8. Set env for production
ENV NODE_ENV=production

# 9. Expose port
EXPOSE 3000

# 10. Start app
CMD ["npm", "start"]
