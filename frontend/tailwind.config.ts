import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      colors: {
        // Base theme - White background
        background: '#FFFFFF',
        foreground: '#1E293B', // Slate Gray
        card: '#FFFFFF',
        'card-foreground': '#1E293B',
        popover: '#FFFFFF',
        'popover-foreground': '#1E293B',
        // Primary - Indigo Blue
        primary: '#4F46E5',
        'primary-foreground': '#FFFFFF',
        secondary: '#F8FAFC',
        'secondary-foreground': '#1E293B',
        accent: '#4F46E5',
        'accent-foreground': '#FFFFFF',
        // Status colors
        destructive: '#F43F5E', // Rose
        'destructive-foreground': '#FFFFFF',
        success: '#10B981', // Emerald
        'success-foreground': '#FFFFFF',
        warning: '#F59E0B', // Amber
        'warning-foreground': '#FFFFFF',
        // Neutral
        muted: '#F1F5F9',
        'muted-foreground': '#64748B',
        border: '#E5E7EB',
        input: '#E5E7EB',
        ring: '#4F46E5',
      },
      borderRadius: {
        lg: '0.75rem',
        md: 'calc(0.75rem - 2px)',
        sm: 'calc(0.75rem - 4px)',
      },
      boxShadow: {
        'blue': '0 4px 14px 0 rgba(0, 118, 255, 0.2)',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-in': {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.3s ease-out',
        'slide-in': 'slide-in 0.3s ease-out',
      },
      backgroundImage: {
        'gradient-primary': 'linear-gradient(135deg, hsl(210 100% 50%) 0%, hsl(199 89% 48%) 100%)',
        'gradient-subtle': 'linear-gradient(135deg, hsl(210 100% 98%) 0%, hsl(210 100% 99%) 100%)',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
    require('@tailwindcss/forms'),
    require('tailwindcss-animate'),
  ],
};

export default config;
