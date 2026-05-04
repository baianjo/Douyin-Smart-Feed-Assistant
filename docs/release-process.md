# Release Process

## Semi-automatic release flow

1. Update implementation in `src/`.
2. Adjust the version with `npm version <patch|minor|major>` or an explicit version.
3. Run `npm run release:check`.
4. Review the generated diff, especially `dist/smart-feed-assistant.user.js`.
5. Commit the source changes and the rebuilt `dist`.
6. Push to GitHub and prepare the release notes manually.
7. Update the existing Greasy Fork script entry with the rebuilt `dist` artifact.

## Notes

- The GitHub raw install URL must continue to point at `main/dist/smart-feed-assistant.user.js`.
- Greasy Fork keeps the existing script ID; do not create a replacement entry for routine releases.
- Release notes should summarize user-facing behavior changes and selector/provider maintenance updates.
