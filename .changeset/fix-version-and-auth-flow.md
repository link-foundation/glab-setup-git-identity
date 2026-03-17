---
'glab-setup-git-identity': patch
---

Fix --version showing 'unknown' and fix auth flow for unauthenticated users

- Fix --version to explicitly read version from package.json (yargs auto-detection fails when installed globally with bun)
- Fix isGlabAuthenticated to detect invalid/missing tokens even when glab auth status exits with code 0
- Suppress noisy glab auth status output by using mirror: false with capture: true in command-stream
- Add mirror: false to all captured command executions to prevent output leaking to terminal
