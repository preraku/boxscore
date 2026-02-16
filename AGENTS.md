# Repository Guidelines

## Project Structure & Module Organization
- `src/` contains the app source. `src/App.tsx` holds the main UI and game-state logic, `src/main.tsx` is the React entry point, and `src/*.css` defines styles.
- `public/` contains static files served as-is.
- `dist/` is the production build output (generated; do not edit manually).
- `.github/workflows/deploy-pages.yml` defines the GitHub Pages build/deploy pipeline.
- Top-level config: `vite.config.ts`, `eslint.config.js`, `tsconfig*.json`, `index.html`.

## Build, Test, and Development Commands
- `npm install` installs dependencies (CI uses npm).  
  Example: `npm install`
- `npm run dev` starts the Vite dev server for local development.
- `npm run build` runs TypeScript project build checks and creates `dist/`.
- `npm run preview` serves the production build locally.
- `npm run lint` runs ESLint across the codebase.
- `bun install` / `bun run dev` also work locally, but prefer npm parity before pushing.
- If `bun` is not on `PATH`, use `/usr/local/bun/bin/bun` directly

## Coding Style & Naming Conventions
- Language: TypeScript + React function components.
- Follow strict TypeScript settings; avoid `any` unless unavoidable.
- Use 2-space indentation and keep existing semicolon-free style.
- Component/type naming: `PascalCase` (`TeamSize`, `PersistedState`).
- Variables/functions: `camelCase` (`startGame`, `teamPoints`).
- Keep helper utilities near related logic in `src/App.tsx` unless a clear module split improves readability.
- Run `npm run lint` and resolve warnings/errors before opening a PR.

## Testing Guidelines
- No automated test framework is currently configured in this repository.
- For now, validate changes with:
  1. `npm run lint`
  2. `npm run build`
  3. Manual browser checks of setup, scoring actions, undo, name edits, and share flow.
- If you add tests, colocate with source using `*.test.ts` / `*.test.tsx` naming.

## Commit & Pull Request Guidelines
- Use short, imperative commit messages consistent with history (`Add REB and TOV`, `Save game to localStorage`).
- Keep commits focused on one logical change.
- PRs should include:
  1. What changed and why.
  2. How to verify (commands + manual steps).
  3. Screenshots/GIFs for UI behavior changes.
  4. Linked issue or task when applicable.
