namespace NodeJS {
  export interface ProcessEnv {
    // API Configuration
    NEXT_PUBLIC_API_URL: string;
    
    // App Configuration
    NEXT_PUBLIC_APP_NAME: string;
    NEXT_PUBLIC_APP_ENV: 'development' | 'production' | 'test';
    
    // Features
    NEXT_PUBLIC_ENABLE_ANALYTICS: string;
    NEXT_PUBLIC_ENABLE_MAINTENANCE_MODE: string;
    
    // Authentication
    NEXT_PUBLIC_AUTH_COOKIE_NAME: string;
    NEXT_PUBLIC_AUTH_COOKIE_MAX_AGE: string;
    
    // Pagination
    NEXT_PUBLIC_DEFAULT_PAGE_SIZE: string;
    
    // Date/Time
    NEXT_PUBLIC_DATE_FORMAT: string;
    NEXT_PUBLIC_DATE_TIME_FORMAT: string;
  }
}

// This file ensures TypeScript recognizes your environment variables
declare namespace NodeJS {
  export interface ProcessEnv extends NodeJS.ProcessEnv {}
}
