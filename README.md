# glab-setup-git-identity

A tool to setup git identity based on current GitLab user.

[![npm version](https://img.shields.io/npm/v/glab-setup-git-identity)](https://www.npmjs.com/package/glab-setup-git-identity)
[![License: Unlicense](https://img.shields.io/badge/license-Unlicense-blue.svg)](http://unlicense.org/)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen.svg)](https://nodejs.org/)

## Overview

`glab-setup-git-identity` is a CLI tool that simplifies setting up your git identity using your GitLab account. It automatically fetches your GitLab username and primary email address, then configures git with these values.

Instead of manually running:

```bash
# Authenticate with GitLab (interactive mode - no extra flags)
glab auth login

# Or for non-interactive mode with a token:
# glab auth login --hostname gitlab.com --git-protocol https --token YOUR_TOKEN

glab auth git-credential # For HTTPS authentication helper

# Get user info (requires jq to be installed)
USERNAME=$(glab api user | jq -r '.username')
EMAIL=$(glab api user | jq -r '.email')

git config --global user.name "$USERNAME"
git config --global user.email "$EMAIL"
```

> **Note for manual commands**: The commands above require `jq` to be installed (`apt install jq` or `brew install jq`). The `glab api` command does not have a built-in `--jq` flag - you must pipe output to the external `jq` tool.

You can simply run:

```bash
glab-setup-git-identity
```

## Features

- **Automatic identity setup**: Fetches username and email from GitLab
- **Global and local configuration**: Configure git globally or per-repository
- **Authentication check**: Prompts you to login if not authenticated
- **Git credential helper setup**: Automatically configures git to use GitLab CLI for HTTPS authentication
- **Dry-run mode**: Preview changes without making them
- **Cross-platform**: Works on macOS, Linux, and Windows
- **Verbose mode**: Built-in verbose mode for debugging
- **Self-hosted GitLab support**: Works with GitLab.com and self-hosted instances

## Prerequisites

- Node.js >= 20.0.0 (or Bun >= 1.0.0)
- Git (installed and configured)
- GitLab CLI (`glab`) installed

To install GitLab CLI, see: https://gitlab.com/gitlab-org/cli#installation

## Installation

### Global Installation (CLI)

```bash
# Using npm
npm install -g glab-setup-git-identity

# Using bun
bun install -g glab-setup-git-identity
```

### Local Installation (Library)

```bash
# Using npm
npm install glab-setup-git-identity

# Using bun
bun install glab-setup-git-identity
```

## CLI Usage

### Basic Usage

```bash
# Setup git identity globally (default)
glab-setup-git-identity

# Setup git identity for current repository only
glab-setup-git-identity --local

# Preview what would be configured (dry run)
glab-setup-git-identity --dry-run

# Verify current git identity configuration
glab-setup-git-identity --verify

# Enable verbose output
glab-setup-git-identity --verbose
```

### CLI Options

```
Usage: glab-setup-git-identity [options]

Git Identity Options:
  --global, -g         Set git config globally (default: true)
  --local, -l          Set git config locally (in current repository)
  --dry-run, --dry     Dry run - show what would be done without making changes
  --verify             Verify current git identity configuration
  --verbose, -v        Enable verbose output

GitLab Authentication Options:
  --hostname           GitLab hostname to authenticate with (default: gitlab.com)
  --token, -t          GitLab access token (reads from stdin if --stdin is used)
  --stdin              Read token from standard input
  --git-protocol, -p   Protocol for git operations: ssh, https, or http (default: https)
  --api-protocol       Protocol for API calls: https or http (default: https)
  --api-host           Custom API host URL
  --use-keyring        Store token in system keyring
  --job-token, -j      CI job token for authentication

General Options:
  --help, -h           Show help
  --version            Show version number
```

### Advanced Authentication Examples

```bash
# Authenticate with self-hosted GitLab
glab-setup-git-identity --hostname gitlab.company.com

# Use SSH protocol instead of HTTPS
glab-setup-git-identity --git-protocol ssh

# Authenticate with token from environment variable
echo "$GITLAB_TOKEN" | glab-setup-git-identity --stdin

# Use token-based authentication directly
glab-setup-git-identity --token glpat-xxxxx

# Store credentials in system keyring
glab-setup-git-identity --use-keyring

# Use in CI/CD with job token
glab-setup-git-identity --job-token "$CI_JOB_TOKEN" --hostname gitlab.company.com
```

### First Run (Not Authenticated)

If you haven't authenticated with GitLab CLI yet, the tool will automatically start the authentication process:

```
GitLab CLI is not authenticated. Starting authentication...

Starting GitLab CLI authentication...

? What GitLab instance do you want to log into? gitlab.com
? What is your preferred protocol for Git operations? HTTPS
? How would you like to login? Token

Tip: you can generate a Personal Access Token here https://gitlab.com/-/profile/personal_access_tokens
The minimum required scopes are 'api' and 'write_repository'.
? Paste your authentication token:
```

The tool runs `glab auth login` automatically, followed by configuring git to use GitLab CLI as the credential helper. Follow the prompts to complete login.

If automatic authentication fails, you can run the commands manually:

```bash
glab auth login
```

### Authentication in Docker/Server Environments (Headless)

When running in Docker containers or on remote servers without a browser, `glab auth login` will display a URL to open but fail to launch a browser:

```
Failed opening a browser at https://gitlab.com/oauth/authorize?...
Encountered error: exec: "xdg-open": executable file not found in $PATH
Try entering the URL in your browser manually.
```

**To complete authentication in headless environments:**

1. **Copy the authorization URL** displayed by glab and open it in your local browser
2. Complete the GitLab OAuth flow in your browser
3. You'll be redirected to a URL like: `http://localhost:7171/auth/redirect?code=...&state=...`
4. **Use `curl` to send the redirect URL back to glab**:

```bash
# Method 1: Using screen (recommended for Docker)
# Terminal 1: Start glab auth in screen
screen -S glab-auth
glab auth login
# Press Ctrl+A, D to detach from screen

# Terminal 2: After completing OAuth in browser, send the redirect URL
curl -L "http://localhost:7171/auth/redirect?code=YOUR_CODE&state=YOUR_STATE"

# Return to screen to see auth completion
screen -r glab-auth
```

```bash
# Method 2: Using SSH port forwarding (for remote servers)
# On your local machine, forward the callback port:
ssh -L 7171:localhost:7171 user@remote-server

# Then on the server, run glab auth login
# The OAuth redirect will go through the SSH tunnel to your local machine
```

**Alternatively, use token-based authentication** (recommended for CI/CD and automation):

```bash
# Generate a Personal Access Token at:
# https://gitlab.com/-/profile/personal_access_tokens
# Required scopes: api, write_repository

# Then authenticate non-interactively:
glab auth login --hostname gitlab.com --token YOUR_TOKEN

# Or with this tool:
glab-setup-git-identity --token YOUR_TOKEN
```

### Successful Run

```
Fetching GitLab user information...
  GitLab user: your-username
  GitLab email: your-email@example.com

Configuring git (global)...
  Git identity configured successfully!

  Git configured:
    user.name:  your-username
    user.email: your-email@example.com
  Scope: global (--global)

Git identity setup complete!

You can verify your configuration with:
  glab auth status
  git config --global user.name
  git config --global user.email
```

### Verifying Configuration

You can verify your git identity configuration at any time using:

```bash
glab-setup-git-identity --verify
```

Or by running the verification commands directly:

```bash
glab auth status
git config --global user.name
git config --global user.email
```

For local repository configuration, use `--local`:

```bash
glab-setup-git-identity --verify --local
git config --local user.name
git config --local user.email
```

## Library Usage

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

// Login with CI job token
await runGlabAuthLogin({
  hostname: 'gitlab.company.com',
  jobToken: 'CI_JOB_TOKEN_VALUE',
});
```

#### `runGlabAuthSetupGit(options?)`

Configure git to use GitLab CLI as a credential helper for HTTPS operations.

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
//   apiProtocol: 'https',
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

Or via CLI:

```bash
glab-setup-git-identity --hostname gitlab.company.com
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
