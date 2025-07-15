/**
 * Sales mode configuration
 * This file handles the sales mode feature which hides certain features in the UI
 * Works in both client and server contexts
 */

/**
 * Check if sales mode is enabled from environment variable
 * 
 * In client components: Uses NEXT_PUBLIC_SALES_MODE
 * In server components/middleware: Uses process.env.NEXT_PUBLIC_SALES_MODE
 */
export const isSalesMode = (): boolean => {
  // Client-side execution
  if (typeof window !== 'undefined') {
    // Prefer value injected at runtime from _document.tsx
    if (window.__ENV__ && typeof window.__ENV__.NEXT_PUBLIC_SALES_MODE !== 'undefined') {
      return window.__ENV__.NEXT_PUBLIC_SALES_MODE === 'true';
    }

    // Fall back to value inlined at build time
    return process.env.NEXT_PUBLIC_SALES_MODE === 'true';
  }

  // Server-side or middleware execution
  return process.env.NEXT_PUBLIC_SALES_MODE === 'true';
};

// For TypeScript
declare global {
  interface Window {
    __ENV__?: {
      NEXT_PUBLIC_SALES_MODE?: string;
    };
  }
}
