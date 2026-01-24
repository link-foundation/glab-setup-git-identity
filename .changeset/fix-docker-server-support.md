---
'glab-setup-git-identity': patch
---

Fix Docker/server support and glab --jq compatibility

- Fix README.md manual commands to use pipe to jq instead of --jq flag
- Add "Authentication in Docker/Server Environments" section to README
- Enhance CLI with helpful headless auth instructions
- Fix src/index.js to parse JSON in JavaScript for better glab version compatibility
- Optimize getGitLabUserInfo to use a single API call
