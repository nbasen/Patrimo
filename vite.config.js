import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base relativa ('./') para o app funcionar tanto em localhost quanto sob o
// subcaminho do GitHub Pages (https://<user>.github.io/<repo>/).
export default defineConfig({
  base: './',
  plugins: [react()],
})
