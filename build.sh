#!/bin/bash

# Build Next.js application (regular build, not static export)
cd frontend
npm run build
cd ..

# Build Go application
go build -o main .

echo "Build completed!"
echo "To run in production:"
echo "1. Start Next.js: cd frontend && npm start"
echo "2. Start Gin server: ./main"