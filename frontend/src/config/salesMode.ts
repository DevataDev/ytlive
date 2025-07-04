/**
 * Sales mode configuration
 * This file handles the sales mode feature which hides certain features in the UI
 */

// Check if sales mode is enabled from environment variable
export const SALES_MODE = process.env.NEXT_PUBLIC_SALES_MODE === 'true' || process.env.SALES_MODE === 'true';

// Export a function to check if sales mode is enabled
export const isSalesMode = (): boolean => {
  return SALES_MODE;
};
