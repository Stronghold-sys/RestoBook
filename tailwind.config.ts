import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#e85d04',
          hover: '#dc4c04',
        },
        secondary: '#dc2626',
        accent: '#f59e0b',
        background: {
          light: '#fff8f0',
          dark: '#0f172a',
        },
        card: {
          light: '#ffffff',
          dark: '#1e293b',
        },
        text: {
          light: '#1f2937',
          dark: '#f1f5f9',
        },
        muted: '#6b7280',
        border: {
          light: '#e5e7eb',
          dark: '#334155',
        }
      },
    },
  },
  plugins: [],
};
export default config;
