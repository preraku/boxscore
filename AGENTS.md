# Repository Guidelines

## Project Structure & Module Organization
- `src/` contains the app source. `src/App.tsx` holds the main UI and game-state logic, `src/main.tsx` is the React entry point, and `src/*.css` defines styles.
- Share-image capture markup is rendered into a hidden body portal (`.share-capture-portal-root`) so it stays off-screen without affecting page scroll.
- `public/` contains static files served as-is.
- `dist/` is the production build output (generated; do not edit manually).
- `.github/workflows/deploy-pages.yml` defines the GitHub Pages build/deploy pipeline.
- Top-level config: `vite.config.ts`, `eslint.config.js`, `tsconfig*.json`, `index.html`.

## Build, Test, and Development Commands
- `bun install` installs dependencies (`bun install --frozen-lockfile` is used in CI).  
  Example: `bun install`
- `bun run dev` starts the Vite dev server for local development.
- `bun run build` runs TypeScript project build checks and creates `dist/`.
- `bun run preview` serves the production build locally.
- `bun run lint` runs ESLint across the codebase.
- If `bun` is not on `PATH`, use `/usr/local/bun/bin/bun` directly

## Coding Style & Naming Conventions
- Language: TypeScript + React function components.
- Follow strict TypeScript settings; avoid `any` unless unavoidable.
- Use 2-space indentation and keep existing semicolon-free style.
- Component/type naming: `PascalCase` (`TeamSize`, `PersistedState`).
- Variables/functions: `camelCase` (`startGame`, `teamPoints`).
- Keep helper utilities near related logic in `src/App.tsx` unless a clear module split improves readability.
- Run `bun run lint` and resolve warnings/errors before opening a PR.

## Testing Guidelines
- No automated test framework is currently configured in this repository.
- For now, validate changes with:
  1. `bun run lint`
  2. `bun run build`
  3. Manual browser checks of setup, scoring actions, undo, name edits, and share flow.
- If you add tests, colocate with source using `*.test.ts` / `*.test.tsx` naming.
