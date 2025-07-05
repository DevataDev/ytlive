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
  // For client-side
  if (typeof window !== 'undefined') {
    // Access from window.__ENV__ if available (runtime)
    if (window.__ENV__ && window.__ENV__.NEXT_PUBLIC_SALES_MODE) {
        console.log("Sales mode found in window.__ENV__");
      return window.__ENV__.NEXT_PUBLIC_SALES_MODE === 'true';
    } else {
        console.log("Sales mode not found in window.__ENV__");
        return process.env.NEXT_PUBLIC_SALES_MODE === 'true';
    }
  }
  
  // For server-side or fallback
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
