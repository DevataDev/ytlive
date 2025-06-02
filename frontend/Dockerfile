# Use the official Node.js LTS image
FROM node:18-alpine AS deps

# Set working directory
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* pnpm-lock.yaml* ./
RUN npm install

# Copy all files
COPY . .

# Build the Next.js app
# RUN npm run build

# Use a lightweight production image
FROM node:18-alpine AS runner

WORKDIR /app

# Copy from previous stage
COPY --from=deps /app ./

# Expose the default Next.js port
EXPOSE 3000

# Start the app
CMD ["npm", "run", "start"]
