# Rabbito Agent Guide

Welcome aboard! This document explains how the repository is structured, which tools drive the workflows, and what conventions to keep in mind while shipping changes.

## Repository layout
- `src/index.ts` – the library entry point. Exports `findBestDownloadUrl` and `checkUrlsHealth`. Keep helper logic close to these functions.
- `src/types.ts` – shared option/result types referenced by the public API. Update this file alongside runtime changes so the types remain accurate.
- `src/index.test.ts` – Bun-powered unit tests covering the runtime behavior. Tests live next to the code they exercise.
- `tsdown.config.ts` – official [tsdown](https://tsdown.dev) build configuration that emits the ESM bundle and declaration files into `dist/`.
- `biome.json` – formatting (4-space indent, 120-column width) and lint settings.
- `README.md` – user-facing documentation. Keep usage snippets and option docs synchronized with the actual API.

## Tooling & commands
- Dependency management: `bun install` / `bun update`.
- Formatting & linting: `bun run format` and `bun run lint` (Biome 2.x).
- Type checking: `bun run typecheck` (`tsc --noEmit`).
- Building: `bun run build`, which runs `tsdown` using `tsdown.config.ts` and writes to `dist/`.
- Tests: `bun test` (Bun's test runner). Keep the suite green before committing.

## Code style & conventions
- Favor descriptive JSDoc blocks for every exported function and type alias so downstream consumers inherit accurate IntelliSense.
- Use explicit return types on exported functions.
- Tests should follow the existing `bun:test` idioms (use `describe/it`, `jest.fn()` utilities, and restore globals in `afterEach`).
- Avoid introducing runtime dependencies unless absolutely necessary—the package currently ships with zero dependencies.
- When touching build tooling, prefer configuration via `tsdown.config.ts` over bespoke scripts.

## Review checklist
1. Format and lint the code (Biome).
2. Run `bun run build` and `bun test` for any implementation change.
3. Update docs (`README.md`, `AGENTS.md`) whenever behavior, tooling, or workflows change.
4. Document any command failures caused by the environment in your final summary.

Thanks for helping keep Rabbito fast and reliable! 🐰
