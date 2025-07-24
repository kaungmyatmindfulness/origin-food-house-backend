// Polyfill for crypto.randomUUID() to ensure it's available globally
import { randomUUID } from 'crypto';

// Make crypto available globally if it's not already
if (typeof globalThis.crypto === 'undefined') {
  globalThis.crypto = {
    randomUUID,
  } as any;
}

// Also ensure global.crypto is available for backward compatibility
if (typeof (global as any).crypto === 'undefined') {
  (global as any).crypto = {
    randomUUID,
  };
}
