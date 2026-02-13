import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const isGitHubPagesBuild = process.env.GITHUB_PAGES === 'true'
const repositoryName = process.env.GITHUB_REPOSITORY?.split('/')[1]
const basePath =
  isGitHubPagesBuild && repositoryName ? `/${repositoryName}/` : '/'

export default defineConfig({
  plugins: [react()],
  base: basePath,
})
