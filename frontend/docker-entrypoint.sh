#!/bin/sh

# Set runtime environment variables for API URLs
export API_URL="${API_URL:-${NEXT_PUBLIC_API_URL:-http://localhost:8081}}"
export API_BASE_URL="${API_BASE_URL:-${NEXT_PUBLIC_API_BASE_URL:-http://localhost:8081}}"

# NextAuth configuration - these are read at runtime by NextAuth
export NEXTAUTH_URL="${NEXTAUTH_URL:-http://localhost:3000}"
export NEXTAUTH_SECRET="${NEXTAUTH_SECRET:-your-secret-key}"

echo "Starting frontend with configuration:"
echo "API_URL: $API_URL"
echo "API_BASE_URL: $API_BASE_URL"
echo "NEXTAUTH_URL: $NEXTAUTH_URL"
echo "NEXTAUTH_SECRET: [HIDDEN]"

# Execute the main command
exec "$@"