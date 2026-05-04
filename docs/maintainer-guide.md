# Maintainer Guide

## Workspace baseline

- Local working directory: `E:\ProgramProject\jsProject\douyin-smart-feed-assistant`
- Runtime baseline: `Node 24.15.0` managed through `nvm for Windows`
- Package manager: `npm`
- Release artifact: `dist/smart-feed-assistant.user.js`

## Source of truth

- `src/` contains the implementation source.
- `dist/smart-feed-assistant.user.js` is a committed release artifact and must always be regenerated from source.
- `package.json` is the single source of truth for the script version.

## Main subsystems

- `src/config/catalog.ts`: default config, selector catalog, provider metadata, templates
- `src/storage/config-storage.ts`: Greasemonkey persistence and compatibility validation
- `src/extractor/video-extractor.ts`: feed item lookup and metadata extraction
- `src/ai/ai-service.ts`: provider request assembly, response parsing, retry-compatible API surface
- `src/ui/ui.ts`: floating button, panel, logs, settings interactions
- `src/controller/controller.ts`: runtime loop, stats, retries, recovery behavior
- `src/bootstrap/init.ts`: Douyin-only entry gate and delayed startup

## Maintenance checklist

- If Douyin updates break extraction, inspect selector failures first and update the selector arrays in `src/config/catalog.ts`.
- If a provider changes its payload contract, update the provider metadata in `src/config/catalog.ts` before touching request logic.
- Keep GM storage keys backward compatible. Add new fields only as optional defaults.
- Never hand-edit `dist/smart-feed-assistant.user.js`; rebuild it from source.

## Validation flow

1. `npm run lint`
2. `npm run typecheck`
3. `npm run test`
4. `npm run build`
5. `npm run dist:check`
