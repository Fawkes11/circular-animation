import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'

const repoName = 'circular-animation'

export default defineConfig({
  base: `/${repoName}/`, 
  plugins: [
    tailwindcss(),
    react()],
})
