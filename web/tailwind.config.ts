import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0B1929',
        surface: '#16293D',
        border: 'rgba(200,212,224,0.12)',
        gold: '#C9A84C',
        textPri: '#E8EFF5',
        textSec: '#8A9BAD',
        success: '#4AC47A',
        danger: '#C45A4A',
      },
    },
  },
  plugins: [],
};

export default config;
