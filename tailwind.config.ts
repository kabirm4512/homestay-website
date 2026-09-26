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
        // Alpine Forest / Pine Slate - Signature Mountain Sanctuary
        primary: {
          50: '#F4F7F5',
          100: '#E4EDE8',
          200: '#C7DBD1',
          300: '#9FBEAF',
          400: '#6B9983',
          500: '#3D6C56',
          600: '#2C5342',
          700: '#224234',
          800: '#1B342A',
          900: '#142820', // Signature Alpine Forest Slate
          950: '#0C1A14',
        },
        // Warm Spiced Mountain Terracotta - Welcoming Fireplace Accent
        terracotta: {
          50: '#FDF8F5',
          100: '#FAF0EB',
          200: '#F4DDCE',
          300: '#EABFA9',
          400: '#DE9C7B',
          500: '#C85A32', // Warm Spiced Terracotta
          600: '#B64B25',
          700: '#973B1C',
          800: '#7B311A',
          900: '#642B1A',
        },
        // Muted Himalayan Brass / Champagne Gold
        brass: {
          50: '#FCF9F2',
          100: '#F8F2E2',
          200: '#EFE2C2',
          300: '#E4CE98',
          400: '#D7B66E',
          500: '#C5A059', // Himalayan Brass
          600: '#AA8344',
          700: '#876435',
          800: '#6E502E',
          900: '#5A4227',
        },
        // Organic Warm Linen / Sand
        sand: {
          50: '#FAF8F5',
          100: '#F5F2EB',
          200: '#ECE6D8',
          300: '#DDD4C0',
          400: '#C5B9A1',
          500: '#A99C83',
          600: '#8F8269',
          700: '#736853',
          800: '#5B5242',
          900: '#423C30',
        },
        // Backward-compatible alias: maps forest -> signature primary alpine slate
        forest: {
          50: '#F4F7F5',
          100: '#E4EDE8',
          200: '#C7DBD1',
          300: '#9FBEAF',
          400: '#6B9983',
          500: '#3D6C56',
          600: '#2C5342',
          700: '#224234',
          800: '#1B342A',
          900: '#142820',
          950: '#0C1A14',
        },
        // Backward-compatible alias: maps wizzOrange -> spiced terracotta
        wizzOrange: {
          50: '#FDF8F5',
          100: '#FAF0EB',
          200: '#F4DDCE',
          300: '#EABFA9',
          400: '#DE9C7B',
          500: '#C85A32',
          600: '#B64B25',
          700: '#973B1C',
          800: '#7B311A',
          900: '#642B1A',
        },
        wizzNavy: {
          800: '#1B342A',
          900: '#142820',
          950: '#0C1A14',
        },
        grey: {
          50: '#FBFBFA',
          100: '#F4F3F1',
          200: '#EAE8E4',
          300: '#D6D3CD',
          400: '#A6A29A',
          500: '#77736A',
          600: '#58554E',
          700: '#413E39',
          800: '#2D2B27',
          900: '#1C1B18',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        outfit: ['var(--font-outfit)', 'sans-serif'],
        serif: ['var(--font-playfair)', 'Georgia', 'serif'],
        heading: ['var(--font-playfair)', 'Georgia', 'serif'],
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
