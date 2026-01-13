# glab-setup-git-identity

Setup git identity using GitLab CLI (glab) - Configure `git user.name` and `user.email` from your GitLab account.

Similar to [gh-setup-git-identity](https://github.com/link-foundation/gh-setup-git-identity) but for GitLab.

## Prerequisites

- [GitLab CLI (glab)](https://gitlab.com/gitlab-org/cli) installed
- Authenticated with GitLab via `glab auth login`

## Installation

```bash
# Using npm
npm install glab-setup-git-identity

# Using bun
bun install glab-setup-git-identity

# Using yarn
yarn add glab-setup-git-identity

# Using pnpm
pnpm add glab-setup-git-identity
```

## Quick Start

### Manual Setup (using glab directly)

```bash
# Install glab CLI
brew install glab  # macOS
# or see https://gitlab.com/gitlab-org/cli#installation for other platforms

# Authenticate with GitLab
glab auth login

# Clone a repository
git clone https://gitlab.com/your-username/your-repo
```

### Using this library

```javascript
import {
  isGlabAuthenticated,
  runGlabAuthLogin,
  runGlabAuthSetupGit,
  setupGitIdentity,
  verifyGitIdentity,
} from 'glab-setup-git-identity';

// Check if already authenticated
const authenticated = await isGlabAuthenticated();

if (!authenticated) {
  // Run interactive login
  await runGlabAuthLogin();
}

// Setup git credential helper for GitLab HTTPS operations
// This configures git to use glab for authentication when pushing/pulling
await runGlabAuthSetupGit();

// Setup git identity from GitLab account
const { username, email } = await setupGitIdentity();
console.log(`Configured git as: ${username} <${email}>`);

// Verify the configuration
const identity = await verifyGitIdentity();
console.log('Current git identity:', identity);
```

## API Reference

### Authentication Functions

#### `isGlabAuthenticated(options?)`

Check if GitLab CLI is authenticated.

```javascript
const authenticated = await isGlabAuthenticated({
  hostname: 'gitlab.company.com', // optional, for self-hosted GitLab
  verbose: true, // optional, enable debug logging
});
```

#### `runGlabAuthLogin(options?)`

Run `glab auth login` interactively or with a token.

```javascript
// Interactive login
await runGlabAuthLogin();

// Login with token (non-interactive)
await runGlabAuthLogin({
  hostname: 'gitlab.com',
  token: 'your-access-token',
  gitProtocol: 'https', // 'ssh', 'https', or 'http'
  useKeyring: true, // store token in OS keyring
});
```

#### `runGlabAuthSetupGit(options?)`

Configure git to use GitLab CLI as a credential helper for HTTPS operations. This is the equivalent of `gh auth setup-git` for GitHub CLI.

Without this configuration, `git push/pull` may fail with "could not read Username" error when using HTTPS protocol.

```javascript
// Setup credential helper for gitlab.com
await runGlabAuthSetupGit();

// Setup for self-hosted GitLab
await runGlabAuthSetupGit({
  hostname: 'gitlab.company.com',
  force: true, // overwrite existing configuration
  verbose: true,
});
```

The function automatically detects the glab installation path, so it works regardless of how glab was installed (Homebrew, apt, npm, etc.).

#### `getGlabPath(options?)`

Get the full path to the glab executable. Useful for debugging or custom integrations.

```javascript
const glabPath = await getGlabPath();
console.log(`glab is installed at: ${glabPath}`);
// e.g., /opt/homebrew/bin/glab, /usr/bin/glab, etc.
```

### User Information Functions

#### `getGitLabUsername(options?)`

Get the authenticated GitLab username.

```javascript
const username = await getGitLabUsername();
```

#### `getGitLabEmail(options?)`

Get the primary email from the GitLab account.

```javascript
const email = await getGitLabEmail();
```

#### `getGitLabUserInfo(options?)`

Get both username and email.

```javascript
const { username, email } = await getGitLabUserInfo({
  hostname: 'gitlab.company.com', // optional
});
```

### Git Configuration Functions

#### `setGitConfig(key, value, options?)`

Set a git configuration value.

```javascript
await setGitConfig('user.name', 'John Doe', {
  scope: 'global', // or 'local'
});
```

#### `getGitConfig(key, options?)`

Get a git configuration value.

```javascript
const name = await getGitConfig('user.name', {
  scope: 'global', // or 'local'
});
```

### Identity Setup Functions

#### `setupGitIdentity(options?)`

Configure git identity based on GitLab user.

```javascript
const { username, email } = await setupGitIdentity({
  hostname: 'gitlab.com', // optional
  scope: 'global', // or 'local'
  dryRun: false, // set to true to preview changes without applying
  verbose: true, // enable debug logging
});
```

#### `verifyGitIdentity(options?)`

Get the current git identity configuration.

```javascript
const { username, email } = await verifyGitIdentity({
  scope: 'global', // or 'local'
});
```

### Default Options

```javascript
import { defaultAuthOptions } from 'glab-setup-git-identity';

console.log(defaultAuthOptions);
// {
//   hostname: 'gitlab.com',
//   gitProtocol: 'https',
//   useKeyring: false
// }
```

## Token Requirements

When using token-based authentication, ensure your GitLab access token has the following minimum scopes:

- `api` - Full API access
- `write_repository` - Push access to repositories

## Self-Hosted GitLab

All functions support the `hostname` option for self-hosted GitLab instances:

```javascript
await setupGitIdentity({
  hostname: 'gitlab.company.com',
});
```

## TypeScript Support

This package includes TypeScript type definitions. All interfaces are exported:

```typescript
import type {
  AuthOptions,
  AuthStatusOptions,
  SetupGitOptions,
  UserInfoOptions,
  GitConfigOptions,
  SetupOptions,
  UserInfo,
  GitIdentity,
} from 'glab-setup-git-identity';
```

## Multi-Runtime Support

This package works with:

- **Node.js** (>=20.0.0)
- **Bun** (>=1.0.0)
- **Deno**

## License

[Unlicense](LICENSE) - Public Domain
