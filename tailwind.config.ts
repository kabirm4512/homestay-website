import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Wizz Holidays Official Sapphire Primary
        primary: {
          50: '#F3F7FF',
          100: '#E9EDFA',
          200: '#C7D4F5',
          300: '#9BB4EE',
          400: '#5687E4',
          500: '#25479E', // Wizz primary blue
          600: '#1F3C86',
          700: '#182F69',
          800: '#12244F',
          900: '#0B1733', // Wizz deep navy
          950: '#070E20',
        },
        // Wizz Holidays Vibrant Orange CTA
        wizzOrange: {
          50: '#FFF7ED',
          100: '#FFEDD5',
          200: '#FED7AA',
          300: '#FDBA74',
          400: '#FB923C',
          500: '#FE6E00', // Wizz CTA orange
          600: '#EA580C',
          700: '#C2410C',
          800: '#9A3412',
          900: '#7C2D12',
        },
        // Wizz Holidays Deep Navy
        wizzNavy: {
          800: '#12244F',
          900: '#0B1733',
          950: '#070E20',
        },
        // Backward-compatible alias: maps forest -> primary sapphire
        forest: {
          50: '#F3F7FF',
          100: '#E9EDFA',
          200: '#C7D4F5',
          300: '#9BB4EE',
          400: '#4A72CC',
          500: '#25479E',
          600: '#1F3C86',
          700: '#182F69',
          800: '#12244F',
          900: '#0B1733',
          950: '#070E20',
        },
        // Backward-compatible alias: maps sand -> clean warm tones / wizz accents
        sand: {
          50: '#F8FAFC',
          100: '#F1F5F9',
          200: '#E2E8F0',
          300: '#CBD5E1',
          400: '#94A3B8',
          500: '#64748B',
          600: '#475569',
          700: '#334155',
          800: '#1E293B',
          900: '#0F172A',
        },
        // Backward-compatible alias: maps terracotta -> wizz orange
        terracotta: {
          50: '#FFF7ED',
          100: '#FFEDD5',
          200: '#FED7AA',
          300: '#FDBA74',
          400: '#FB923C',
          500: '#FE6E00',
          600: '#EA580C',
          700: '#C2410C',
          800: '#9A3412',
          900: '#7C2D12',
        },
        grey: {
          50: '#F9FAFB',
          100: '#F2F4F7',
          200: '#EAECF0',
          300: '#D0D5DD',
          400: '#98A2B3',
          500: '#667085',
          600: '#475467',
          700: '#344054',
          800: '#1D2939',
          900: '#101828',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        outfit: ['var(--font-outfit)', 'sans-serif'],
        heading: ['var(--font-outfit)', 'sans-serif'],
        serif: ['var(--font-outfit)', 'Georgia', 'serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out forwards',
        'slide-up': 'slideUp 0.4s ease-out forwards',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(16px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
export default config;
