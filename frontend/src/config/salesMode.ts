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
    // hardcoded sales mode
    return true;
};

// For TypeScript
declare global {
  interface Window {
    __ENV__?: {
      NEXT_PUBLIC_SALES_MODE?: string;
    };
  }
}
