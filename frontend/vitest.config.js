import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.{test,spec}.?(c|m)[jt]s?(x)', '../EHR/src/**/*.{test,spec}.?(c|m)[jt]s?(x)'],
  },
});
