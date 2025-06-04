#!/bin/sh

# Set runtime environment variables for API URLs
export API_URL="${API_URL:-${NEXT_PUBLIC_API_URL:-http://localhost:8081}}"
export API_BASE_URL="${API_BASE_URL:-${NEXT_PUBLIC_API_BASE_URL:-http://localhost:8081}}"

# NextAuth configuration - these are read at runtime by NextAuth
export NEXTAUTH_URL="${NEXTAUTH_URL:-http://localhost:3000}"
export NEXTAUTH_SECRET="${NEXTAUTH_SECRET:-your-secret-key}"
export JWT_SECRET="${JWT_SECRET:-your-jwt-secret-key}"

echo "Starting frontend with configuration:"
echo "API_URL: $API_URL"
echo "API_BASE_URL: $API_BASE_URL"
echo "NEXTAUTH_URL: $NEXTAUTH_URL"
echo "NEXTAUTH_SECRET: [HIDDEN]"
echo "JWT_SECRET: [HIDDEN]"


# # Injecting to .env.local
# echo "NEXT_PUBLIC_API_URL=$API_URL" > /app/.env.local
# echo "NEXT_PUBLIC_API_BASE_URL=$API_BASE_URL" >> /app/.env.local
# echo "API_URL=$API_URL" >> /app/.env.local
# echo "API_BASE_URL=$API_BASE_URL" >> /app/.env.local
# echo "NEXTAUTH_URL=$NEXTAUTH_URL" >> /app/.env.local
# echo "NEXTAUTH_SECRET=$NEXTAUTH_SECRET" >> /app/.env.local
# echo "JWT_SECRET=$JWT_SECRET" >> /app/.env.local

# create public/config.json
echo "{\"apiUrl\": \"$API_URL\", \"apiBaseUrl\": \"$API_BASE_URL\"}" > /app/public/config.json


# Execute the main command
exec "$@"