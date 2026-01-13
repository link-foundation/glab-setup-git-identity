#!/usr/bin/env node

/**
 * glab-setup-git-identity - Core library for setting up git identity using GitLab CLI
 *
 * This library provides functionality to:
 * - Check if GitLab CLI is authenticated
 * - Get GitLab user information (username and email)
 * - Configure git user.name and user.email
 */

import { spawn } from 'node:child_process';

/**
 * Create a logger instance
 * This can be customized by users when using the library
 */
function createDefaultLogger(options = {}) {
  const { verbose = false, logger = console } = options;

  return {
    log: (...args) => logger.log(...args),
    error: (...args) => (logger.error || logger.log)(...args),
    warn: (...args) => (logger.warn || logger.log)(...args),
    debug: (...args) => {
      if (verbose) {
        (logger.debug || logger.log)(...args);
      }
    },
  };
}

/**
 * Execute a command and return the result
 *
 * @param {string} command - The command to execute
 * @param {string[]} args - The command arguments
 * @param {Object} options - Spawn options
 * @returns {Promise<{stdout: string, stderr: string, exitCode: number}>}
 */
function execCommand(command, args = [], options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      stdio: 'pipe',
      shell: false,
      ...options,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (exitCode) => {
      resolve({
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: exitCode || 0,
      });
    });

    child.on('error', (error) => {
      resolve({
        stdout: stdout.trim(),
        stderr: error.message,
        exitCode: 1,
      });
    });
  });
}

/**
 * Execute an interactive command (inheriting stdio)
 *
 * @param {string} command - The command to execute
 * @param {string[]} args - The command arguments
 * @param {Object} options - Options
 * @param {string} options.input - Optional input to pipe to stdin
 * @returns {Promise<{exitCode: number}>}
 */
function execInteractiveCommand(command, args = [], options = {}) {
  return new Promise((resolve) => {
    const { input } = options;
    const child = spawn(command, args, {
      stdio: input ? ['pipe', 'inherit', 'inherit'] : 'inherit',
      shell: false,
    });

    if (input && child.stdin) {
      child.stdin.write(input);
      child.stdin.end();
    }

    child.on('close', (exitCode) => {
      resolve({
        exitCode: exitCode || 0,
      });
    });

    child.on('error', (error) => {
      console.error(`Failed to execute command: ${error.message}`);
      resolve({
        exitCode: 1,
      });
    });
  });
}

/**
 * Default options for glab auth login
 */
export const defaultAuthOptions = {
  hostname: 'gitlab.com',
  gitProtocol: 'https',
  useKeyring: false,
};

/**
 * Get the full path to the glab executable
 *
 * This function dynamically detects the glab installation path
 * without depending on any specific installation method.
 *
 * @param {Object} options - Options
 * @param {boolean} options.verbose - Enable verbose logging
 * @param {Object} options.logger - Custom logger
 * @returns {Promise<string>} Full path to glab executable
 * @throws {Error} If glab is not found
 */
export async function getGlabPath(options = {}) {
  const { verbose = false, logger = console } = options;
  const log = createDefaultLogger({ verbose, logger });

  log.debug('Detecting glab installation path...');

  // Use 'which' on Unix-like systems or 'where' on Windows
  const command = process.platform === 'win32' ? 'where' : 'which';
  const result = await execCommand(command, ['glab']);

  if (result.exitCode !== 0 || !result.stdout) {
    throw new Error(
      'glab CLI not found. Please install glab: https://gitlab.com/gitlab-org/cli#installation'
    );
  }

  // Get the first line (in case multiple paths are returned)
  const glabPath = result.stdout.split('\n')[0].trim();
  log.debug(`Found glab at: ${glabPath}`);

  return glabPath;
}

/**
 * Run glab auth login interactively
 *
 * @param {Object} options - Options
 * @param {string} options.hostname - GitLab hostname (default: 'gitlab.com')
 * @param {string} options.token - GitLab access token (optional, for non-interactive login)
 * @param {string} options.gitProtocol - Git protocol: 'ssh', 'https', or 'http' (default: 'https')
 * @param {boolean} options.useKeyring - Store token in OS keyring (default: false)
 * @param {boolean} options.verbose - Enable verbose logging
 * @param {Object} options.logger - Custom logger
 * @returns {Promise<boolean>} True if login was successful
 */
export async function runGlabAuthLogin(options = {}) {
  const {
    hostname = defaultAuthOptions.hostname,
    token,
    gitProtocol = defaultAuthOptions.gitProtocol,
    useKeyring = defaultAuthOptions.useKeyring,
    verbose = false,
    logger = console,
  } = options;

  const log = createDefaultLogger({ verbose, logger });

  // Build the arguments for glab auth login
  const args = ['auth', 'login'];

  // Add hostname
  if (hostname) {
    args.push('--hostname', hostname);
  }

  // Add git protocol
  if (gitProtocol) {
    args.push('--git-protocol', gitProtocol);
  }

  // Add keyring flag if specified
  if (useKeyring) {
    args.push('--use-keyring');
  }

  // If token is provided, use stdin mode
  if (token) {
    args.push('--stdin');
  }

  log.debug(`Running: glab ${args.join(' ')}`);

  // Run glab auth login
  const result = await execInteractiveCommand('glab', args, {
    input: token ? `${token}\n` : undefined,
  });

  if (result.exitCode !== 0) {
    log.error('GitLab CLI authentication failed');
    return false;
  }

  log.log('\nGitLab CLI authentication successful!');
  return true;
}

/**
 * Run glab auth setup-git equivalent to configure git to use GitLab CLI as credential helper
 *
 * Unlike GitHub CLI which has `gh auth setup-git`, GitLab CLI doesn't have an equivalent command.
 * This function manually configures git to use `glab auth git-credential` as the credential helper
 * for GitLab HTTPS operations.
 *
 * Without this, git push/pull may fail with "could not read Username" error when using HTTPS protocol.
 *
 * @param {Object} options - Options
 * @param {string} options.hostname - GitLab hostname (default: 'gitlab.com')
 * @param {boolean} options.force - Force setup by overwriting existing credential helper config (default: false)
 * @param {boolean} options.verbose - Enable verbose logging
 * @param {Object} options.logger - Custom logger
 * @returns {Promise<boolean>} True if setup was successful
 */
export async function runGlabAuthSetupGit(options = {}) {
  const {
    hostname = defaultAuthOptions.hostname,
    force = false,
    verbose = false,
    logger = console,
  } = options;

  const log = createDefaultLogger({ verbose, logger });

  log.debug('Configuring git credential helper for GitLab CLI...');

  try {
    // Get the full path to glab executable
    const glabPath = await getGlabPath({ verbose, logger });

    // Build the credential helper URL based on hostname
    const credentialUrl = `https://${hostname}`;

    // The credential helper command - uses the dynamically detected glab path
    const credentialHelper = `!${glabPath} auth git-credential`;

    // Check if there's an existing credential helper for this host
    const existingHelper = await execCommand('git', [
      'config',
      '--global',
      '--get',
      `credential.${credentialUrl}.helper`,
    ]);

    if (existingHelper.exitCode === 0 && existingHelper.stdout && !force) {
      log.debug(
        `Existing credential helper found for ${hostname}: ${existingHelper.stdout}`
      );
      log.log(
        `Git credential helper already configured for ${hostname}. Use force: true to overwrite.`
      );
      return true;
    }

    // First, clear any existing credential helpers for this host
    // This ensures we have a clean state
    log.debug(`Clearing existing credential helpers for ${credentialUrl}...`);

    // Set an empty helper first to clear the chain (ignore errors if not set)
    await execCommand('git', [
      'config',
      '--global',
      `credential.${credentialUrl}.helper`,
      '',
    ]);

    // Add the glab credential helper
    log.debug(`Setting credential helper: ${credentialHelper}`);

    const result = await execCommand('git', [
      'config',
      '--global',
      '--add',
      `credential.${credentialUrl}.helper`,
      credentialHelper,
    ]);

    if (result.exitCode !== 0) {
      log.error(`Failed to set git credential helper: ${result.stderr}`);
      return false;
    }

    log.log(`Git credential helper configured for ${hostname}`);
    log.debug(`  URL: ${credentialUrl}`);
    log.debug(`  Helper: ${credentialHelper}`);

    return true;
  } catch (error) {
    log.error(`Failed to setup git credential helper: ${error.message}`);
    return false;
  }
}

/**
 * Check if GitLab CLI is authenticated
 *
 * @param {Object} options - Options
 * @param {string} options.hostname - GitLab hostname to check (optional)
 * @param {boolean} options.verbose - Enable verbose logging
 * @param {Object} options.logger - Custom logger
 * @returns {Promise<boolean>} True if authenticated
 */
export async function isGlabAuthenticated(options = {}) {
  const { hostname, verbose = false, logger = console } = options;
  const log = createDefaultLogger({ verbose, logger });

  log.debug('Checking GitLab CLI authentication status...');

  const args = ['auth', 'status'];
  if (hostname) {
    args.push('--hostname', hostname);
  }

  const result = await execCommand('glab', args);

  if (result.exitCode !== 0) {
    log.debug(`GitLab CLI is not authenticated: ${result.stderr}`);
    return false;
  }

  log.debug('GitLab CLI is authenticated');
  return true;
}

/**
 * Get GitLab username from authenticated user
 *
 * @param {Object} options - Options
 * @param {string} options.hostname - GitLab hostname (optional)
 * @param {boolean} options.verbose - Enable verbose logging
 * @param {Object} options.logger - Custom logger
 * @returns {Promise<string>} GitLab username
 */
export async function getGitLabUsername(options = {}) {
  const { hostname, verbose = false, logger = console } = options;
  const log = createDefaultLogger({ verbose, logger });

  log.debug('Getting GitLab username...');

  const args = ['api', 'user', '--jq', '.username'];
  if (hostname) {
    args.push('--hostname', hostname);
  }

  const result = await execCommand('glab', args);

  if (result.exitCode !== 0) {
    throw new Error(`Failed to get GitLab username: ${result.stderr}`);
  }

  const username = result.stdout;
  log.debug(`GitLab username: ${username}`);

  return username;
}

/**
 * Get primary email from GitLab user
 *
 * @param {Object} options - Options
 * @param {string} options.hostname - GitLab hostname (optional)
 * @param {boolean} options.verbose - Enable verbose logging
 * @param {Object} options.logger - Custom logger
 * @returns {Promise<string>} Primary email address
 */
export async function getGitLabEmail(options = {}) {
  const { hostname, verbose = false, logger = console } = options;
  const log = createDefaultLogger({ verbose, logger });

  log.debug('Getting GitLab primary email...');

  const args = ['api', 'user', '--jq', '.email'];
  if (hostname) {
    args.push('--hostname', hostname);
  }

  const result = await execCommand('glab', args);

  if (result.exitCode !== 0) {
    throw new Error(`Failed to get GitLab email: ${result.stderr}`);
  }

  const email = result.stdout;

  if (!email) {
    throw new Error(
      'No email found on GitLab account. Please set a primary email in your GitLab settings.'
    );
  }

  log.debug(`GitLab primary email: ${email}`);

  return email;
}

/**
 * Get GitLab user information (username and primary email)
 *
 * @param {Object} options - Options
 * @param {string} options.hostname - GitLab hostname (optional)
 * @param {boolean} options.verbose - Enable verbose logging
 * @param {Object} options.logger - Custom logger
 * @returns {Promise<{username: string, email: string}>} User information
 */
export async function getGitLabUserInfo(options = {}) {
  const [username, email] = await Promise.all([
    getGitLabUsername(options),
    getGitLabEmail(options),
  ]);

  return { username, email };
}

/**
 * Set git config value
 *
 * @param {string} key - Config key (e.g., 'user.name')
 * @param {string} value - Config value
 * @param {Object} options - Options
 * @param {string} options.scope - 'global' or 'local' (default: 'global')
 * @param {boolean} options.verbose - Enable verbose logging
 * @param {Object} options.logger - Custom logger
 * @returns {Promise<void>}
 */
export async function setGitConfig(key, value, options = {}) {
  const { scope = 'global', verbose = false, logger = console } = options;
  const log = createDefaultLogger({ verbose, logger });

  const scopeFlag = scope === 'local' ? '--local' : '--global';

  log.debug(`Setting git config ${key} = ${value} (${scope})`);

  const result = await execCommand('git', ['config', scopeFlag, key, value]);

  if (result.exitCode !== 0) {
    throw new Error(`Failed to set git config ${key}: ${result.stderr}`);
  }

  log.debug(`Successfully set git config ${key}`);
}

/**
 * Get git config value
 *
 * @param {string} key - Config key (e.g., 'user.name')
 * @param {Object} options - Options
 * @param {string} options.scope - 'global' or 'local' (default: 'global')
 * @param {boolean} options.verbose - Enable verbose logging
 * @param {Object} options.logger - Custom logger
 * @returns {Promise<string|null>} Config value or null if not set
 */
export async function getGitConfig(key, options = {}) {
  const { scope = 'global', verbose = false, logger = console } = options;
  const log = createDefaultLogger({ verbose, logger });

  const scopeFlag = scope === 'local' ? '--local' : '--global';

  log.debug(`Getting git config ${key} (${scope})`);

  const result = await execCommand('git', ['config', scopeFlag, key]);

  if (result.exitCode !== 0) {
    log.debug(`Git config ${key} not set`);
    return null;
  }

  const value = result.stdout;
  log.debug(`Git config ${key} = ${value}`);

  return value;
}

/**
 * Setup git identity based on GitLab user
 *
 * @param {Object} options - Options
 * @param {string} options.hostname - GitLab hostname (optional)
 * @param {string} options.scope - 'global' or 'local' (default: 'global')
 * @param {boolean} options.dryRun - Dry run mode (default: false)
 * @param {boolean} options.verbose - Enable verbose logging (default: false)
 * @param {Object} options.logger - Custom logger (default: console)
 * @returns {Promise<{username: string, email: string}>} Configured identity
 */
export async function setupGitIdentity(options = {}) {
  const {
    hostname,
    scope = 'global',
    dryRun = false,
    verbose = false,
    logger = console,
  } = options;

  const log = createDefaultLogger({ verbose, logger });

  log.log('\nFetching GitLab user information...');

  // Get GitLab user info
  const { username, email } = await getGitLabUserInfo({
    hostname,
    verbose,
    logger,
  });

  log.log(`  GitLab user: ${username}`);
  log.log(`  GitLab email: ${email}`);

  if (dryRun) {
    log.log('DRY MODE: Would configure the following:');
    log.log(`  git config --${scope} user.name "${username}"`);
    log.log(`  git config --${scope} user.email "${email}"`);
    return { username, email };
  }

  // Set git config
  log.log(`\nConfiguring git (${scope})...`);

  await setGitConfig('user.name', username, { scope, verbose, logger });
  await setGitConfig('user.email', email, { scope, verbose, logger });

  log.log('  Git identity configured successfully!');

  return { username, email };
}

/**
 * Verify git identity is configured correctly
 *
 * @param {Object} options - Options
 * @param {string} options.scope - 'global' or 'local' (default: 'global')
 * @param {boolean} options.verbose - Enable verbose logging
 * @param {Object} options.logger - Custom logger
 * @returns {Promise<{username: string|null, email: string|null}>} Current git identity
 */
export async function verifyGitIdentity(options = {}) {
  const { scope = 'global', verbose = false, logger = console } = options;

  const username = await getGitConfig('user.name', { scope, verbose, logger });
  const email = await getGitConfig('user.email', { scope, verbose, logger });

  return { username, email };
}

export default {
  defaultAuthOptions,
  getGlabPath,
  isGlabAuthenticated,
  runGlabAuthLogin,
  runGlabAuthSetupGit,
  getGitLabUsername,
  getGitLabEmail,
  getGitLabUserInfo,
  setGitConfig,
  getGitConfig,
  setupGitIdentity,
  verifyGitIdentity,
};
