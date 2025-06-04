import { NextResponse } from 'next/server';

export async function GET() {
  const config = {
    apiUrl: process.env.API_URL || process.env.NEXT_PUBLIC_API_URL,
    apiBaseUrl: process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL,
    // NextAuth URLs for client-side usage if needed
    nextAuthUrl: process.env.NEXTAUTH_URL,
  };

  return NextResponse.json(config);
}