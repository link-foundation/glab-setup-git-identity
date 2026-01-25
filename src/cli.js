#!/usr/bin/env node

/**
 * glab-setup-git-identity CLI
 *
 * Command-line interface for setting up git identity based on GitLab user
 */

import { makeConfig } from 'lino-arguments';
import {
  setupGitIdentity,
  isGlabAuthenticated,
  runGlabAuthLogin,
  runGlabAuthSetupGit,
  verifyGitIdentity,
  defaultAuthOptions,
} from './index.js';
import { $ } from 'command-stream';

// Parse command-line arguments with environment variable and .lenv support
const config = makeConfig({
  yargs: ({ yargs, getenv }) =>
    yargs
      .usage('Usage: $0 [options]')
      // Git identity options
      .option('global', {
        alias: 'g',
        type: 'boolean',
        description: 'Set git config globally (default)',
        default: false,
      })
      .option('local', {
        alias: 'l',
        type: 'boolean',
        description: 'Set git config locally (in current repository)',
        default: getenv('GLAB_SETUP_GIT_IDENTITY_LOCAL', false),
      })
      .option('verbose', {
        alias: 'v',
        type: 'boolean',
        description: 'Enable verbose output',
        default: getenv('GLAB_SETUP_GIT_IDENTITY_VERBOSE', false),
      })
      .option('dry-run', {
        alias: 'dry',
        type: 'boolean',
        description:
          'Dry run mode - show what would be done without making changes',
        default: getenv('GLAB_SETUP_GIT_IDENTITY_DRY_RUN', false),
      })
      .option('verify', {
        type: 'boolean',
        description: 'Verify current git identity configuration',
        default: false,
      })
      // glab auth login options
      .option('hostname', {
        type: 'string',
        description: 'GitLab hostname to authenticate with',
        default: getenv('GLAB_AUTH_HOSTNAME', defaultAuthOptions.hostname),
      })
      .option('token', {
        alias: 't',
        type: 'string',
        description: 'GitLab access token',
        default: getenv('GLAB_AUTH_TOKEN', undefined),
      })
      .option('stdin', {
        type: 'boolean',
        description: 'Read token from standard input',
        default: false,
      })
      .option('git-protocol', {
        alias: 'p',
        type: 'string',
        description: 'Protocol for git operations: ssh, https, or http',
        choices: ['ssh', 'https', 'http'],
        default: getenv(
          'GLAB_AUTH_GIT_PROTOCOL',
          defaultAuthOptions.gitProtocol
        ),
      })
      .option('api-protocol', {
        type: 'string',
        description: 'Protocol for API calls: https or http',
        choices: ['https', 'http'],
        default: getenv(
          'GLAB_AUTH_API_PROTOCOL',
          defaultAuthOptions.apiProtocol
        ),
      })
      .option('api-host', {
        type: 'string',
        description: 'Custom API host URL',
        default: getenv('GLAB_AUTH_API_HOST', undefined),
      })
      .option('use-keyring', {
        type: 'boolean',
        description: 'Store token in system keyring',
        default: getenv('GLAB_AUTH_USE_KEYRING', defaultAuthOptions.useKeyring),
      })
      .option('job-token', {
        alias: 'j',
        type: 'string',
        description: 'CI job token for authentication',
        default: getenv('GLAB_AUTH_JOB_TOKEN', undefined),
      })
      .check((argv) => {
        // --global and --local are mutually exclusive
        if (argv.global && argv.local) {
          throw new Error('Arguments global and local are mutually exclusive');
        }
        // --token and --stdin are mutually exclusive
        if (argv.token && argv.stdin) {
          throw new Error('Arguments token and stdin are mutually exclusive');
        }
        // --token and --job-token are mutually exclusive
        if (argv.token && argv.jobToken) {
          throw new Error(
            'Arguments token and job-token are mutually exclusive'
          );
        }
        return true;
      })
      .example('$0', 'Setup git identity globally using GitLab user')
      .example('$0 --local', 'Setup git identity for current repository only')
      .example(
        '$0 --dry-run',
        'Show what would be configured without making changes'
      )
      .example('$0 --verify', 'Verify current git identity configuration')
      .example(
        '$0 --hostname gitlab.company.com',
        'Authenticate with self-hosted GitLab'
      )
      .example('$0 --git-protocol ssh', 'Use SSH protocol for git operations')
      .example(
        'echo "$TOKEN" | $0 --stdin',
        'Authenticate using token from stdin'
      )
      .example('$0 --token glpat-xxxxx', 'Authenticate using a token directly')
      .example(
        '$0 --job-token "$CI_JOB_TOKEN"',
        'Authenticate using CI job token'
      )
      .help('h')
      .alias('h', 'help')
      .version()
      .strict(),
});

/**
 * Run verification commands and display results
 * @param {string} scope - 'global' or 'local'
 * @param {boolean} verbose - Enable verbose logging
 */
async function runVerify(scope, verbose) {
  const scopeFlag = scope === 'local' ? '--local' : '--global';

  console.log('Verifying git identity configuration...');
  console.log('');

  // 1. Run glab auth status
  console.log('1. GitLab CLI authentication status:');
  console.log('   $ glab auth status');
  console.log('');

  // Run glab auth status - use command-stream with inherited stdio for interactive output
  try {
    await $`glab auth status`.run({ mirror: { stdout: true, stderr: true } });
  } catch {
    // Continue even if not authenticated
  }

  console.log('');

  // 2. Get git config user.name
  console.log(`2. Git user.name (${scope}):`);
  console.log(`   $ git config ${scopeFlag} user.name`);

  const identity = await verifyGitIdentity({ scope, verbose });

  if (identity.username) {
    console.log(`   ${identity.username}`);
  } else {
    console.log('   (not set)');
  }

  console.log('');

  // 3. Get git config user.email
  console.log(`3. Git user.email (${scope}):`);
  console.log(`   $ git config ${scopeFlag} user.email`);

  if (identity.email) {
    console.log(`   ${identity.email}`);
  } else {
    console.log('   (not set)');
  }

  console.log('');
  console.log('Verification complete!');
}

/**
 * Get auth options from CLI config
 * @returns {Object} Auth options
 */
function getAuthOptions() {
  return {
    hostname: config.hostname,
    token: config.token,
    gitProtocol: config.gitProtocol,
    apiProtocol: config.apiProtocol,
    apiHost: config.apiHost,
    useKeyring: config.useKeyring,
    jobToken: config.jobToken,
    stdin: config.stdin,
    verbose: config.verbose,
  };
}

/**
 * Handle authentication flow
 * @returns {Promise<boolean>} True if authentication succeeded or already authenticated
 */
async function ensureAuthenticated() {
  const authenticated = await isGlabAuthenticated({
    hostname: config.hostname,
    verbose: config.verbose,
  });

  if (authenticated) {
    return handleAlreadyAuthenticated();
  }

  return handleNotAuthenticated();
}

/**
 * Handle case when already authenticated
 * @returns {Promise<boolean>} True
 */
async function handleAlreadyAuthenticated() {
  // Ensure git credential helper is configured
  const setupGitSuccess = await runGlabAuthSetupGit({
    hostname: config.hostname,
    verbose: config.verbose,
  });

  if (!setupGitSuccess && config.verbose) {
    console.log(
      'Note: Git credential helper may not be configured. Consider running:'
    );
    console.log(
      '  Configure manually or use --force option to overwrite existing config'
    );
  }

  return true;
}

/**
 * Print headless authentication instructions
 */
function printHeadlessAuthInstructions() {
  console.log('');
  console.log('=== Authentication in Docker/Server Environments ===');
  console.log('');
  console.log(
    'If you see a browser URL but cannot open it, follow these steps:'
  );
  console.log('');
  console.log('1. Copy the authorization URL displayed above');
  console.log('2. Open it in your local browser and complete the OAuth flow');
  console.log(
    '3. You will be redirected to: http://localhost:7171/auth/redirect?code=...&state=...'
  );
  console.log('4. Use curl to send that redirect URL back to glab:');
  console.log('');
  console.log(
    '   curl -L "http://localhost:7171/auth/redirect?code=YOUR_CODE&state=YOUR_STATE"'
  );
  console.log('');
  console.log('Alternatively, use token-based authentication:');
  console.log('');
  console.log('1. Generate a Personal Access Token at:');
  console.log(`   https://${config.hostname}/-/profile/personal_access_tokens`);
  console.log('   Required scopes: api, write_repository');
  console.log('');
  console.log('2. Re-run with your token:');
  console.log(`   glab-setup-git-identity --token YOUR_TOKEN`);
  console.log('');
  console.log('================================================');
}

/**
 * Handle case when not authenticated
 * @returns {Promise<boolean>} True if login succeeded
 */
async function handleNotAuthenticated() {
  console.log('GitLab CLI is not authenticated. Starting authentication...');
  console.log('');

  // Print headless instructions before attempting auth
  // This helps users in Docker/server environments know what to do
  printHeadlessAuthInstructions();
  console.log('');

  const loginSuccess = await runGlabAuthLogin(getAuthOptions());

  if (!loginSuccess) {
    console.log('');
    console.log('Authentication failed. Please try one of the following:');
    console.log('');
    console.log('Option 1: Interactive login');
    console.log('  glab auth login');
    console.log('');
    console.log('Option 2: Token-based login (recommended for headless)');
    console.log(
      `  glab auth login --hostname ${config.hostname} --token YOUR_TOKEN`
    );
    console.log('');
    console.log('Option 3: Use this tool with a token');
    console.log(`  glab-setup-git-identity --token YOUR_TOKEN`);
    return false;
  }

  // Setup git credential helper after successful login
  const setupGitSuccess = await runGlabAuthSetupGit({
    hostname: config.hostname,
    verbose: config.verbose,
  });

  if (!setupGitSuccess) {
    console.log('');
    console.log(
      'Warning: Failed to setup git credential helper. HTTPS git operations may require manual authentication.'
    );
  }

  return true;
}

/**
 * Display the setup results
 * @param {Object} result - Setup result with username and email
 * @param {Object} options - Setup options
 */
function displayResults(result, options) {
  const { scope, dryRun } = options;

  console.log('');
  console.log(`  ${dryRun ? '[DRY MODE] Would configure' : 'Git configured'}:`);
  console.log(`    user.name:  ${result.username}`);
  console.log(`    user.email: ${result.email}`);
  console.log(
    `  Scope: ${scope === 'global' ? 'global (--global)' : 'local (--local)'}`
  );

  if (!dryRun) {
    console.log('');
    console.log('Git identity setup complete!');
    console.log('');
    console.log('You can verify your configuration with:');
    console.log('  glab auth status');
    console.log(
      `  git config ${scope === 'global' ? '--global' : '--local'} user.name`
    );
    console.log(
      `  git config ${scope === 'global' ? '--global' : '--local'} user.email`
    );
  }
}

/**
 * Main CLI function
 */
async function main() {
  try {
    const scope = config.local ? 'local' : 'global';

    // Handle --verify mode
    if (config.verify) {
      await runVerify(scope, config.verbose);
      process.exit(0);
    }

    // Ensure authenticated
    const authSuccess = await ensureAuthenticated();
    if (!authSuccess) {
      process.exit(1);
    }

    // Prepare options
    const options = {
      hostname: config.hostname,
      scope,
      dryRun: config.dryRun,
      verbose: config.verbose,
    };

    if (options.verbose) {
      console.log('Options:', options);
    }

    if (options.dryRun) {
      console.log('');
      console.log('DRY MODE - No actual changes will be made');
    }

    // Setup git identity
    const result = await setupGitIdentity(options);

    // Display results
    displayResults(result, options);

    process.exit(0);
  } catch (error) {
    console.error('');
    console.error('Error:', error.message);

    if (config.verbose) {
      console.error('Stack trace:');
      console.error(error.stack);
    }

    process.exit(1);
  }
}

// Run the CLI
main();
