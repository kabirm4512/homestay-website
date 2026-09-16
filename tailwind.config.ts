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
        forest: {
          50: '#f2f7f4',
          100: '#e1ede6',
          200: '#c5dccf',
          300: '#9ec2b0',
          400: '#73a38d',
          500: '#538670',
          600: '#3f6c58',
          700: '#345747',
          800: '#2c473b',
          900: '#1b2d25',
          950: '#0f1a15',
        },
        sand: {
          50: '#faf8f5',
          100: '#f4efe8',
          200: '#ebdccb',
          300: '#dec4a8',
          400: '#cea681',
          500: '#bf8c60',
          600: '#ab764f',
          700: '#8d5d41',
          800: '#734c38',
          900: '#5e3f30',
        },
        terracotta: {
          50: '#fdf4f0',
          100: '#fbe7de',
          200: '#f7d0bf',
          300: '#f1b197',
          400: '#e78564',
          500: '#df633b',
          600: '#cb4a27',
          700: '#a7381c',
          800: '#87301c',
          900: '#712b1d',
        },
      },
      fontFamily: {
        serif: ['Georgia', 'Cambria', '"Times New Roman"', 'Times', 'serif'],
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
