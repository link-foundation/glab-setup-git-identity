/**
 * glab-setup-git-identity - Type definitions for setting up git identity using GitLab CLI
 */

/**
 * Logger options for customizing output
 */
export interface LoggerOptions {
  /** Enable verbose/debug logging */
  verbose?: boolean;
  /** Custom logger instance (defaults to console) */
  logger?: {
    log: (...args: unknown[]) => void;
    error?: (...args: unknown[]) => void;
    warn?: (...args: unknown[]) => void;
    debug?: (...args: unknown[]) => void;
  };
}

/**
 * Options for GitLab authentication
 */
export interface AuthOptions extends LoggerOptions {
  /** GitLab instance hostname (default: 'gitlab.com') */
  hostname?: string;
  /** GitLab access token for non-interactive login */
  token?: string;
  /** Git protocol: 'ssh', 'https', or 'http' (default: 'https') */
  gitProtocol?: 'ssh' | 'https' | 'http';
  /** Store token in OS keyring */
  useKeyring?: boolean;
}

/**
 * Options for checking authentication status
 */
export interface AuthStatusOptions extends LoggerOptions {
  /** GitLab instance hostname to check */
  hostname?: string;
}

/**
 * Options for setting up git credential helper
 */
export interface SetupGitOptions extends LoggerOptions {
  /** GitLab instance hostname (default: 'gitlab.com') */
  hostname?: string;
  /** Force setup by overwriting existing credential helper config (default: false) */
  force?: boolean;
}

/**
 * Options for getting user information
 */
export interface UserInfoOptions extends LoggerOptions {
  /** GitLab instance hostname */
  hostname?: string;
}

/**
 * Options for git config operations
 */
export interface GitConfigOptions extends LoggerOptions {
  /** Config scope: 'global' or 'local' (default: 'global') */
  scope?: 'global' | 'local';
}

/**
 * Options for setting up git identity
 */
export interface SetupOptions extends LoggerOptions {
  /** GitLab instance hostname */
  hostname?: string;
  /** Config scope: 'global' or 'local' (default: 'global') */
  scope?: 'global' | 'local';
  /** Dry run mode - don't actually configure git */
  dryRun?: boolean;
}

/**
 * User information returned from GitLab
 */
export interface UserInfo {
  /** GitLab username */
  username: string;
  /** Primary email address */
  email: string;
}

/**
 * Git identity configuration
 */
export interface GitIdentity {
  /** Configured user.name or null if not set */
  username: string | null;
  /** Configured user.email or null if not set */
  email: string | null;
}

/**
 * Default options for glab auth login
 */
export declare const defaultAuthOptions: {
  hostname: string;
  gitProtocol: string;
  useKeyring: boolean;
};

/**
 * Get the full path to the glab executable
 *
 * This function dynamically detects the glab installation path
 * without depending on any specific installation method.
 *
 * @param options - Logger options
 * @returns Full path to glab executable
 * @throws Error if glab is not found
 */
export declare function getGlabPath(options?: LoggerOptions): Promise<string>;

/**
 * Run glab auth login interactively
 * @param options - Authentication options
 * @returns True if login was successful
 */
export declare function runGlabAuthLogin(
  options?: AuthOptions
): Promise<boolean>;

/**
 * Run glab auth setup-git equivalent to configure git to use GitLab CLI as credential helper
 *
 * Unlike GitHub CLI which has `gh auth setup-git`, GitLab CLI doesn't have an equivalent command.
 * This function manually configures git to use `glab auth git-credential` as the credential helper
 * for GitLab HTTPS operations.
 *
 * Without this, git push/pull may fail with "could not read Username" error when using HTTPS protocol.
 *
 * @param options - Setup options
 * @returns True if setup was successful
 */
export declare function runGlabAuthSetupGit(
  options?: SetupGitOptions
): Promise<boolean>;

/**
 * Check if GitLab CLI is authenticated
 * @param options - Options
 * @returns True if authenticated
 */
export declare function isGlabAuthenticated(
  options?: AuthStatusOptions
): Promise<boolean>;

/**
 * Get GitLab username from authenticated user
 * @param options - Options
 * @returns GitLab username
 * @throws Error if not authenticated or API call fails
 */
export declare function getGitLabUsername(
  options?: UserInfoOptions
): Promise<string>;

/**
 * Get primary email from GitLab user
 * @param options - Options
 * @returns Primary email address
 * @throws Error if not authenticated, API call fails, or no email is set
 */
export declare function getGitLabEmail(
  options?: UserInfoOptions
): Promise<string>;

/**
 * Get GitLab user information (username and primary email)
 * @param options - Options
 * @returns User information object
 * @throws Error if not authenticated or API calls fail
 */
export declare function getGitLabUserInfo(
  options?: UserInfoOptions
): Promise<UserInfo>;

/**
 * Set git config value
 * @param key - Config key (e.g., 'user.name')
 * @param value - Config value
 * @param options - Options
 * @throws Error if git config command fails
 */
export declare function setGitConfig(
  key: string,
  value: string,
  options?: GitConfigOptions
): Promise<void>;

/**
 * Get git config value
 * @param key - Config key (e.g., 'user.name')
 * @param options - Options
 * @returns Config value or null if not set
 */
export declare function getGitConfig(
  key: string,
  options?: GitConfigOptions
): Promise<string | null>;

/**
 * Setup git identity based on GitLab user
 * @param options - Setup options
 * @returns Configured identity (username and email)
 * @throws Error if not authenticated or configuration fails
 */
export declare function setupGitIdentity(
  options?: SetupOptions
): Promise<UserInfo>;

/**
 * Verify git identity is configured correctly
 * @param options - Options
 * @returns Current git identity
 */
export declare function verifyGitIdentity(
  options?: GitConfigOptions
): Promise<GitIdentity>;

/**
 * Default export with all functions
 */
declare const _default: {
  defaultAuthOptions: typeof defaultAuthOptions;
  getGlabPath: typeof getGlabPath;
  isGlabAuthenticated: typeof isGlabAuthenticated;
  runGlabAuthLogin: typeof runGlabAuthLogin;
  runGlabAuthSetupGit: typeof runGlabAuthSetupGit;
  getGitLabUsername: typeof getGitLabUsername;
  getGitLabEmail: typeof getGitLabEmail;
  getGitLabUserInfo: typeof getGitLabUserInfo;
  setGitConfig: typeof setGitConfig;
  getGitConfig: typeof getGitConfig;
  setupGitIdentity: typeof setupGitIdentity;
  verifyGitIdentity: typeof verifyGitIdentity;
};

export default _default;
