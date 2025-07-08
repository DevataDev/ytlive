# 1. Use official Node image
FROM node:18-alpine AS builder

# 2. Set working directory
WORKDIR /app

# 3. Install deps
COPY package*.json ./
COPY tsconfig.json ./
COPY next.config.js ./

RUN npm install

# 4. Copy source
COPY . .

# 5. Build the Next.js app with environment variables
# This creates a build that includes the SALES_MODE setting
ENV NODE_ENV=production
ARG SALES_MODE
ARG NEXT_PUBLIC_SALES_MODE
ENV NEXT_PUBLIC_SALES_MODE=${NEXT_PUBLIC_SALES_MODE:-false} \
    SALES_MODE=${SALES_MODE:-false}
RUN echo "Building with SALES_MODE=${SALES_MODE:-false}"
RUN echo "Building with NEXT_PUBLIC_SALES_MODE=${NEXT_PUBLIC_SALES_MODE:-false}"
RUN npm run build

# --- Final stage: run optimized production build ---
FROM node:18-alpine AS runner

# 6. Set working directory
WORKDIR /app

# 7. Copy built app + node_modules from builder
COPY --from=builder /app ./

# 8. Set env for production
ARG SALES_MODE
ARG NEXT_PUBLIC_SALES_MODE
ENV NEXT_PUBLIC_SALES_MODE=${NEXT_PUBLIC_SALES_MODE:-false} \
    SALES_MODE=${SALES_MODE:-false}

ENV NODE_ENV=production

# 9. Create entrypoint script for runtime configuration
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# 10. Expose port
EXPOSE 3000

# 11. Use entrypoint script
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["npm", "start"]
