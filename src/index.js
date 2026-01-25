#!/usr/bin/env node

/**
 * glab-setup-git-identity - Core library for setting up git identity using GitLab CLI
 *
 * This library provides functionality to:
 * - Check if GitLab CLI is authenticated
 * - Get GitLab user information (username and email)
 * - Configure git user.name and user.email
 */

import { $ } from 'command-stream';

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
 * Default options for glab auth login
 */
export const defaultAuthOptions = {
  hostname: 'gitlab.com',
  gitProtocol: 'https',
  apiProtocol: 'https',
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

  try {
    const result = await $`${command} glab`.run({ capture: true });

    if (result.code !== 0 || !result.stdout) {
      throw new Error(
        'glab CLI not found. Please install glab: https://gitlab.com/gitlab-org/cli#installation'
      );
    }

    // Get the first line (in case multiple paths are returned)
    const glabPath = result.stdout.split('\n')[0].trim();
    log.debug(`Found glab at: ${glabPath}`);

    return glabPath;
  } catch (error) {
    if (error.message.includes('not found')) {
      throw error;
    }
    throw new Error(
      'glab CLI not found. Please install glab: https://gitlab.com/gitlab-org/cli#installation'
    );
  }
}

/**
 * Build glab auth login arguments from options
 * @param {Object} options - Auth options
 * @returns {string[]} Array of CLI arguments
 */
function buildGlabAuthLoginArgs(options) {
  const {
    hostname,
    gitProtocol,
    apiProtocol,
    apiHost,
    useKeyring,
    jobToken,
    token,
    stdin,
  } = options;

  const args = ['auth', 'login'];

  if (hostname) {
    args.push('--hostname', hostname);
  }
  if (gitProtocol) {
    args.push('--git-protocol', gitProtocol);
  }
  if (apiProtocol) {
    args.push('--api-protocol', apiProtocol);
  }
  if (apiHost) {
    args.push('--api-host', apiHost);
  }
  if (useKeyring) {
    args.push('--use-keyring');
  }

  // Handle authentication method (mutually exclusive)
  if (jobToken) {
    args.push('--job-token', jobToken);
  } else if (token) {
    args.push('--token', token);
  } else if (stdin) {
    args.push('--stdin');
  }

  return args;
}

/**
 * Run glab auth login interactively
 *
 * @param {Object} options - Options
 * @param {string} options.hostname - GitLab hostname (default: 'gitlab.com')
 * @param {string} options.token - GitLab access token (optional, for non-interactive login)
 * @param {string} options.gitProtocol - Git protocol: 'ssh', 'https', or 'http' (default: 'https')
 * @param {string} options.apiProtocol - API protocol: 'https' or 'http' (default: 'https')
 * @param {string} options.apiHost - Custom API host URL (optional)
 * @param {boolean} options.useKeyring - Store token in OS keyring (default: false)
 * @param {string} options.jobToken - CI job token for authentication (optional)
 * @param {boolean} options.stdin - Read token from stdin (default: false)
 * @param {boolean} options.verbose - Enable verbose logging
 * @param {Object} options.logger - Custom logger
 * @returns {Promise<boolean>} True if login was successful
 */
export async function runGlabAuthLogin(options = {}) {
  const {
    hostname = defaultAuthOptions.hostname,
    token,
    gitProtocol = defaultAuthOptions.gitProtocol,
    apiProtocol = defaultAuthOptions.apiProtocol,
    apiHost,
    useKeyring = defaultAuthOptions.useKeyring,
    jobToken,
    stdin = false,
    verbose = false,
    logger = console,
  } = options;

  const log = createDefaultLogger({ verbose, logger });

  const args = buildGlabAuthLoginArgs({
    hostname,
    gitProtocol,
    apiProtocol,
    apiHost,
    useKeyring,
    jobToken,
    token,
    stdin,
  });

  log.debug(`Running: glab ${args.join(' ')}`);

  try {
    const result = await $`glab ${args}`.run({
      mirror: { stdout: true, stderr: true },
      stdin: stdin ? 'inherit' : undefined,
    });

    if (result.code !== 0) {
      log.error('GitLab CLI authentication failed');
      return false;
    }

    log.log('\nGitLab CLI authentication successful!');
    return true;
  } catch (error) {
    log.error(`GitLab CLI authentication failed: ${error.message}`);
    return false;
  }
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
    try {
      const existingResult =
        await $`git config --global --get credential.${credentialUrl}.helper`.run(
          { capture: true }
        );

      if (existingResult.code === 0 && existingResult.stdout && !force) {
        log.debug(
          `Existing credential helper found for ${hostname}: ${existingResult.stdout.trim()}`
        );
        log.log(
          `Git credential helper already configured for ${hostname}. Use force: true to overwrite.`
        );
        return true;
      }
    } catch {
      // No existing helper, proceed with setup
    }

    // First, clear any existing credential helpers for this host
    // This ensures we have a clean state
    log.debug(`Clearing existing credential helpers for ${credentialUrl}...`);

    // Set an empty helper first to clear the chain (ignore errors if not set)
    try {
      await $`git config --global credential.${credentialUrl}.helper ""`.run({
        capture: true,
      });
    } catch {
      // Ignore errors if not set
    }

    // Add the glab credential helper
    log.debug(`Setting credential helper: ${credentialHelper}`);

    const result =
      await $`git config --global --add credential.${credentialUrl}.helper ${credentialHelper}`.run(
        { capture: true }
      );

    if (result.code !== 0) {
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

  try {
    const result = await $`glab ${args}`.run({ capture: true });

    if (result.code !== 0) {
      log.debug(`GitLab CLI is not authenticated: ${result.stderr}`);
      return false;
    }

    log.debug('GitLab CLI is authenticated');
    return true;
  } catch (error) {
    log.debug(`GitLab CLI is not authenticated: ${error.message}`);
    return false;
  }
}

/**
 * Get GitLab username from authenticated user
 *
 * Note: This function parses the JSON response in JavaScript rather than using
 * glab's --jq flag, as the --jq flag is not available in all glab versions.
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

  const args = ['api', 'user'];
  if (hostname) {
    args.push('--hostname', hostname);
  }

  const result = await $`glab ${args}`.run({ capture: true });

  if (result.code !== 0) {
    throw new Error(`Failed to get GitLab username: ${result.stderr}`);
  }

  // Parse JSON response in JavaScript (glab's --jq flag is not available in all versions)
  let userData;
  try {
    userData = JSON.parse(result.stdout.trim());
  } catch (parseError) {
    throw new Error(
      `Failed to parse GitLab user data: ${parseError.message}. Raw output: ${result.stdout}`
    );
  }

  const username = userData.username;
  if (!username) {
    throw new Error(
      'No username found in GitLab user data. Please ensure your GitLab account has a username.'
    );
  }

  log.debug(`GitLab username: ${username}`);

  return username;
}

/**
 * Get primary email from GitLab user
 *
 * Note: This function parses the JSON response in JavaScript rather than using
 * glab's --jq flag, as the --jq flag is not available in all glab versions.
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

  const args = ['api', 'user'];
  if (hostname) {
    args.push('--hostname', hostname);
  }

  const result = await $`glab ${args}`.run({ capture: true });

  if (result.code !== 0) {
    throw new Error(`Failed to get GitLab email: ${result.stderr}`);
  }

  // Parse JSON response in JavaScript (glab's --jq flag is not available in all versions)
  let userData;
  try {
    userData = JSON.parse(result.stdout.trim());
  } catch (parseError) {
    throw new Error(
      `Failed to parse GitLab user data: ${parseError.message}. Raw output: ${result.stdout}`
    );
  }

  const email = userData.email;

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
 * Note: This function makes a single API call and parses both username and email
 * from the response, which is more efficient than calling getGitLabUsername and
 * getGitLabEmail separately.
 *
 * @param {Object} options - Options
 * @param {string} options.hostname - GitLab hostname (optional)
 * @param {boolean} options.verbose - Enable verbose logging
 * @param {Object} options.logger - Custom logger
 * @returns {Promise<{username: string, email: string}>} User information
 */
export async function getGitLabUserInfo(options = {}) {
  const { hostname, verbose = false, logger = console } = options;
  const log = createDefaultLogger({ verbose, logger });

  log.debug('Getting GitLab user information...');

  const args = ['api', 'user'];
  if (hostname) {
    args.push('--hostname', hostname);
  }

  const result = await $`glab ${args}`.run({ capture: true });

  if (result.code !== 0) {
    throw new Error(`Failed to get GitLab user info: ${result.stderr}`);
  }

  // Parse JSON response in JavaScript (glab's --jq flag is not available in all versions)
  let userData;
  try {
    userData = JSON.parse(result.stdout.trim());
  } catch (parseError) {
    throw new Error(
      `Failed to parse GitLab user data: ${parseError.message}. Raw output: ${result.stdout}`
    );
  }

  const username = userData.username;
  const email = userData.email;

  if (!username) {
    throw new Error(
      'No username found in GitLab user data. Please ensure your GitLab account has a username.'
    );
  }

  if (!email) {
    throw new Error(
      'No email found on GitLab account. Please set a primary email in your GitLab settings.'
    );
  }

  log.debug(`GitLab username: ${username}`);
  log.debug(`GitLab primary email: ${email}`);

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

  const result = await $`git config ${scopeFlag} ${key} ${value}`.run({
    capture: true,
  });

  if (result.code !== 0) {
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

  const result = await $`git config ${scopeFlag} ${key}`.run({ capture: true });

  if (result.code !== 0) {
    log.debug(`Git config ${key} not set`);
    return null;
  }

  const value = result.stdout.trim();
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
