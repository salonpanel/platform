/**
 * Development logger utility
 * 
 * En producción, estos logs se eliminan automáticamente por el bundler
 * cuando NODE_ENV === 'production'
 */

const isDevelopment = process.env.NODE_ENV !== 'production';

export const devLog = {
  warn: (message: string, ...args: unknown[]) => {
    if (isDevelopment) {
      console.warn(`[DEV] ${message}`, ...args);
    }
  },
  
  error: (message: string, ...args: unknown[]) => {
    if (isDevelopment) {
      console.error(`[DEV] ${message}`, ...args);
    }
  },
  
  info: (message: string, ...args: unknown[]) => {
    if (isDevelopment) {
      console.log(`[DEV] ${message}`, ...args);
    }
  },
};

// Utility para validar valores en development
export const devAssert = (condition: boolean, message: string) => {
  if (isDevelopment && !condition) {
    console.error(`[DEV ASSERT FAILED] ${message}`);
  }
};
