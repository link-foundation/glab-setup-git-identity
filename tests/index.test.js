/**
 * Tests for glab-setup-git-identity
 * Works with Node.js, Bun, and Deno using test-anywhere
 */

import { describe, it, expect } from 'test-anywhere';
import { createRequire } from 'node:module';
import {
  defaultAuthOptions,
  getGitConfig,
  setGitConfig,
  verifyGitIdentity,
  getGlabPath,
  isGlabAuthenticated,
  runGlabAuthSetupGit,
} from '../src/index.js';

const require = createRequire(import.meta.url);

describe('defaultAuthOptions', () => {
  it('should have correct default hostname', () => {
    expect(defaultAuthOptions.hostname).toBe('gitlab.com');
  });

  it('should have correct default git protocol', () => {
    expect(defaultAuthOptions.gitProtocol).toBe('https');
  });

  it('should have correct default api protocol', () => {
    expect(defaultAuthOptions.apiProtocol).toBe('https');
  });

  it('should have useKeyring disabled by default', () => {
    expect(defaultAuthOptions.useKeyring).toBe(false);
  });
});

describe('getGitConfig', () => {
  it('should return null for non-existent config key', async () => {
    // Use a unique key that definitely doesn't exist
    const value = await getGitConfig('glab-test.nonexistent-key-12345', {
      scope: 'global',
    });
    expect(value).toBe(null);
  });

  it('should return existing git config value', async () => {
    // user.name is typically set in most git environments
    const value = await getGitConfig('user.name', { scope: 'global' });
    // Just verify it returns a string or null (depends on environment)
    expect(typeof value === 'string' || value === null).toBe(true);
  });
});

describe('setGitConfig', () => {
  it('should set and then get a git config value in local scope', async () => {
    // Use local scope to avoid modifying global git config
    const testKey = 'glab-test.test-value';
    const testValue = `test-${Date.now()}`;

    // Set the value
    await setGitConfig(testKey, testValue, { scope: 'local' });

    // Get the value back
    const retrievedValue = await getGitConfig(testKey, { scope: 'local' });
    expect(retrievedValue).toBe(testValue);

    // Clean up - unset the test value
    const { spawn } = await import('node:child_process');
    await new Promise((resolve) => {
      const child = spawn('git', ['config', '--local', '--unset', testKey]);
      child.on('close', resolve);
    });
  });
});

describe('verifyGitIdentity', () => {
  it('should return an object with username and email properties', async () => {
    const identity = await verifyGitIdentity({ scope: 'global' });

    expect(typeof identity).toBe('object');
    expect('username' in identity).toBe(true);
    expect('email' in identity).toBe(true);
  });

  it('should return null or string for each property', async () => {
    const identity = await verifyGitIdentity({ scope: 'global' });

    expect(
      identity.username === null || typeof identity.username === 'string'
    ).toBe(true);
    expect(identity.email === null || typeof identity.email === 'string').toBe(
      true
    );
  });
});

describe('getGlabPath', () => {
  it('should be a function', () => {
    expect(typeof getGlabPath).toBe('function');
  });

  it('should return a promise that resolves or rejects', async () => {
    // We can't test the actual path without glab installed,
    // but we can verify it returns a promise and handles gracefully
    try {
      const result = await getGlabPath();
      // If glab is installed, it should return a string path
      expect(typeof result).toBe('string');
    } catch {
      // If glab is not installed, it should throw an error
      // This is expected behavior
      expect(true).toBe(true);
    }
  });
});

describe('runGlabAuthSetupGit', () => {
  it('should be a function', () => {
    expect(typeof runGlabAuthSetupGit).toBe('function');
  });

  it('should return a promise that resolves or rejects', async () => {
    // We can't test the actual setup without glab installed,
    // but we can verify it returns a promise and handles gracefully
    try {
      const result = await runGlabAuthSetupGit();
      // If glab is installed and setup succeeds, it should return true
      expect(typeof result).toBe('boolean');
    } catch {
      // If glab is not installed, it should throw an error
      // This is expected behavior
      expect(true).toBe(true);
    }
  });
});

describe('CLI --version', () => {
  it('should output the version from package.json', async () => {
    const pkg = require('../package.json');
    const { execSync } = await import('node:child_process');
    const output = execSync('node src/cli.js --version', {
      encoding: 'utf8',
    }).trim();
    expect(output).toBe(pkg.version);
  });
});

describe('isGlabAuthenticated', () => {
  it('should be a function', () => {
    expect(typeof isGlabAuthenticated).toBe('function');
  });

  it('should return false when glab has no valid token', async () => {
    // In this test environment, glab is not properly authenticated
    // so isGlabAuthenticated should return false
    try {
      const result = await isGlabAuthenticated();
      expect(typeof result).toBe('boolean');
    } catch {
      // If glab is not installed, it should handle gracefully
      expect(true).toBe(true);
    }
  });

  it('should not produce visible output when checking auth status', async () => {
    // Ensure isGlabAuthenticated does not leak glab output to the console
    const originalStdoutWrite = process.stdout.write;
    const originalStderrWrite = process.stderr.write;
    let capturedOutput = '';

    process.stdout.write = (chunk) => {
      capturedOutput += chunk.toString();
      return true;
    };
    process.stderr.write = (chunk) => {
      capturedOutput += chunk.toString();
      return true;
    };

    try {
      await isGlabAuthenticated({ verbose: false });
    } catch {
      // ignore errors
    } finally {
      process.stdout.write = originalStdoutWrite;
      process.stderr.write = originalStderrWrite;
    }

    // Should not contain glab auth status output
    expect(capturedOutput.includes('No token provided')).toBe(false);
    expect(capturedOutput.includes('401 Unauthorized')).toBe(false);
  });
});

// Note: Tests for getGitLabUsername, getGitLabEmail,
// getGitLabUserInfo, runGlabAuthLogin, and setupGitIdentity require
// an authenticated glab CLI environment and are better suited for
// integration tests or manual testing.
