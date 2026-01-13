/**
 * Basic usage example for glab-setup-git-identity
 * Demonstrates how to use the package
 *
 * Prerequisites:
 * - GitLab CLI (glab) installed
 * - Authenticated with GitLab via `glab auth login`
 *
 * Run with any runtime:
 * - Bun: bun examples/basic-usage.js
 * - Node.js: node examples/basic-usage.js
 * - Deno: deno run --allow-run examples/basic-usage.js
 */

import {
  defaultAuthOptions,
  isGlabAuthenticated,
  getGitLabUserInfo,
  verifyGitIdentity,
  setupGitIdentity,
} from '../src/index.js';

console.log('glab-setup-git-identity - Basic Usage Example\n');

// Show default options
console.log('Default auth options:');
console.log(`  Hostname: ${defaultAuthOptions.hostname}`);
console.log(`  Git protocol: ${defaultAuthOptions.gitProtocol}`);
console.log(`  Use keyring: ${defaultAuthOptions.useKeyring}`);

// Check current git identity
console.log('\nCurrent git identity (global):');
const currentIdentity = await verifyGitIdentity({ scope: 'global' });
console.log(`  user.name: ${currentIdentity.username || '(not set)'}`);
console.log(`  user.email: ${currentIdentity.email || '(not set)'}`);

// Check if glab is authenticated
console.log('\nChecking GitLab CLI authentication...');
const authenticated = await isGlabAuthenticated();

if (!authenticated) {
  console.log('  GitLab CLI is not authenticated.');
  console.log('  Please run: glab auth login');
  console.log('\nExiting example.');
  process.exit(0);
}

console.log('  GitLab CLI is authenticated!');

// Get GitLab user info
console.log('\nFetching GitLab user information...');
try {
  const { username, email } = await getGitLabUserInfo();
  console.log(`  GitLab username: ${username}`);
  console.log(`  GitLab email: ${email}`);

  // Setup git identity (dry run)
  console.log('\nDry run - would configure git as:');
  await setupGitIdentity({ dryRun: true, verbose: false });
} catch (error) {
  console.error(`  Error: ${error.message}`);
}

console.log('\nExample completed!');
