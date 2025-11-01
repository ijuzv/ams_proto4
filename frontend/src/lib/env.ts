// Environment variable type definitions
const env = {
  // API Configuration
  api: {
    baseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
  },
  
  // App Configuration
  app: {
    name: process.env.NEXT_PUBLIC_APP_NAME || 'Attendance Management System',
    enableRegistration: process.env.NEXT_PUBLIC_ENABLE_REGISTRATION === 'true',
    enablePasswordReset: process.env.NEXT_PUBLIC_ENABLE_PASSWORD_RESET === 'true',
    sessionTimeout: parseInt(process.env.NEXT_PUBLIC_SESSION_TIMEOUT || '3600000', 10),
  },
  
  // UI Configuration
  ui: {
    dateFormat: process.env.NEXT_PUBLIC_DATE_FORMAT || 'dd/MM/yyyy',
    dateTimeFormat: process.env.NEXT_PUBLIC_DATE_TIME_FORMAT || 'dd/MM/yyyy HH:mm',
    defaultPageSize: parseInt(process.env.NEXT_PUBLIC_DEFAULT_PAGE_SIZE || '10', 10),
    maxPageSize: parseInt(process.env.NEXT_PUBLIC_MAX_PAGE_SIZE || '100', 10),
  },
  
  // Feature Flags
  features: {
    // Add any feature flags here
    darkMode: true,
    notifications: true,
  },
  
  // Third-party services
  services: {
    googleAnalytics: process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID || '',
    sentryDsn: process.env.NEXT_PUBLIC_SENTRY_DSN || '',
  },
} as const;

// Type-safe environment variables
type Env = typeof env;

declare global {
  // eslint-disable-next-line no-var
  var ENV: Env;
  interface Window {
    ENV: Env;
  }
}

// Only run on client
if (typeof window !== 'undefined') {
  window.ENV = env;
}

export default env;
