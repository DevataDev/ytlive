# -------- Build stage --------
FROM node:20-alpine AS builder

# Accept backend URL at build time so Next.js can inline it into the client bundle
ARG NEXT_PUBLIC_OPS_BACKEND_URL
ARG NEXT_PUBLIC_OPS_API_URL
ENV NEXT_PUBLIC_OPS_BACKEND_URL=${NEXT_PUBLIC_OPS_BACKEND_URL}
ENV NEXT_PUBLIC_OPS_API_URL=${NEXT_PUBLIC_OPS_API_URL}
WORKDIR /app
COPY package*.json ./
RUN npm install --legacy-peer-deps
COPY . .
# Build the production bundle with the supplied environment variables
RUN NEXT_PUBLIC_OPS_BACKEND_URL=${NEXT_PUBLIC_OPS_BACKEND_URL} \
    NEXT_PUBLIC_OPS_API_URL=${NEXT_PUBLIC_OPS_API_URL} \
    npm run build

# -------- Runtime stage --------
FROM node:20-alpine AS runner

# Propagate the env vars at runtime too (useful for SSR requests)
ENV NEXT_PUBLIC_OPS_BACKEND_URL=${NEXT_PUBLIC_OPS_BACKEND_URL}
ENV NEXT_PUBLIC_OPS_API_URL=${NEXT_PUBLIC_OPS_API_URL}
WORKDIR /app
ENV NODE_ENV production
COPY --from=builder /app .
EXPOSE 3100
CMD ["npm","start"]
