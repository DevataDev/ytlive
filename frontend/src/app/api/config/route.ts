import { NextResponse } from 'next/server';

export async function GET() {
  // Debug: log all environment variables that start with API_ or NEXT_
  console.log('Environment variables:');
  Object.keys(process.env)
    .filter(key => key.startsWith('API_') || key.startsWith('NEXT_') || key.startsWith('NEXTAUTH_'))
    .forEach(key => {
      console.log(`${key}: ${process.env[key]}`);
    });

  const config = {
    apiUrl: process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8081',
    apiBaseUrl: process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8081',
    nextAuthUrl: process.env.NEXTAUTH_URL || 'http://localhost:3000',
  };

  console.log('Config being returned:', config);
  return NextResponse.json(config);
}