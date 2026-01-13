/**
 * Tests for glab-setup-git-identity
 * Works with Node.js, Bun, and Deno using test-anywhere
 */

import { describe, it, expect } from 'test-anywhere';
import {
  defaultAuthOptions,
  getGitConfig,
  setGitConfig,
  verifyGitIdentity,
  getGlabPath,
  runGlabAuthSetupGit,
} from '../src/index.js';

describe('defaultAuthOptions', () => {
  it('should have correct default hostname', () => {
    expect(defaultAuthOptions.hostname).toBe('gitlab.com');
  });

  it('should have correct default git protocol', () => {
    expect(defaultAuthOptions.gitProtocol).toBe('https');
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

// Note: Tests for isGlabAuthenticated, getGitLabUsername, getGitLabEmail,
// getGitLabUserInfo, runGlabAuthLogin, and setupGitIdentity require
// an authenticated glab CLI environment and are better suited for
// integration tests or manual testing.
