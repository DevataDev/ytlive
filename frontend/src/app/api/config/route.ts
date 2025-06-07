import { NextResponse } from 'next/server';

export async function GET() {
  // Debug: collect environment variables
  const envVars = {};
  Object.keys(process.env)
    .filter(key => key.startsWith('API_') || key.startsWith('NEXT_') || key.startsWith('NEXTAUTH_'))
    .forEach(key => {
      (envVars as Record<string, string | undefined>)[key] = process.env[key];
    });

  const config = {
    apiUrl: process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8081',
    apiBaseUrl: process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8081',
    nextAuthUrl: process.env.NEXTAUTH_URL || 'http://localhost:3000',
  };

  // Return both config and debug info
  return NextResponse.json({
    config,
    debug: {
      environmentVariables: envVars,
      processEnvKeys: Object.keys(process.env).length
    }
  });
}