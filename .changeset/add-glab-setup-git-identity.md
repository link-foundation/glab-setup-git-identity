---
'glab-setup-git-identity': minor
---

Implement glab-setup-git-identity - GitLab CLI (glab) based git identity setup

This is the initial implementation similar to gh-setup-git-identity but for GitLab.

Features:

- Check GitLab CLI authentication status
- Run interactive or token-based authentication
- Get GitLab user information (username and email)
- Configure git user.name and user.email from GitLab account
- Support for global and local git config scopes
- Dry-run mode for previewing changes
- Support for self-hosted GitLab instances via hostname option
- Full TypeScript type definitions included
