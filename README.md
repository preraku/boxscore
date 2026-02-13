# Boxscore

Boxscore tracker built with React + TypeScript + Vite.

## Local development

```bash
bun install
bun run dev
```

## Deploy to GitHub Pages

This repository is configured to deploy from GitHub Actions.

1. In GitHub, open `preraku/boxscore` -> `Settings` -> `Pages`.
2. Under `Build and deployment`, set `Source` to `GitHub Actions`.
3. Push to `main` (or run the `Deploy to GitHub Pages` workflow manually from the Actions tab).
4. Wait for the workflow to finish, then open:
   `https://preraku.github.io/boxscore/`

Notes:
- The workflow file is `.github/workflows/deploy-pages.yml`.
- Vite base path is auto-set during Pages builds using the current repository name.
