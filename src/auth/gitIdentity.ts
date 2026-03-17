import { execFile } from 'child_process';
import { promisify } from 'util';
import type { Author } from '../types.js';

const exec = promisify(execFile);

/**
 * Reads the user's identity from git config.
 * Falls back to sensible defaults if git isn't available or not configured.
 */
export async function getGitIdentity(): Promise<Author> {
  try {
    const [nameResult, emailResult] = await Promise.all([
      exec('git', ['config', '--get', 'user.name']),
      exec('git', ['config', '--get', 'user.email']),
    ]);

    const name = nameResult.stdout.trim();
    const email = emailResult.stdout.trim();

    if (name && email) {
      return { name, email };
    }
  } catch {
    // git not available or not configured
  }

  return { name: 'Anonymous', email: '' };
}

/**
 * Returns the current git branch name.
 * Falls back to 'unknown' if git isn't available or not in a repo.
 */
export async function getGitBranch(cwd?: string): Promise<string> {
  try {
    const result = await exec('git', ['rev-parse', '--abbrev-ref', 'HEAD'], cwd ? { cwd } : undefined);
    const branch = result.stdout.trim();
    if (branch) return branch;
  } catch {
    // git not available or not a git repo
  }
  return 'unknown';
}

/**
 * Returns true if .ide-comments/ has any uncommitted changes (new, modified, or untracked).
 */
export async function hasUncommittedIdeComments(cwd?: string): Promise<boolean> {
  try {
    const result = await exec('git', ['status', '--porcelain', '.ide-comments/'], cwd ? { cwd } : undefined);
    return result.stdout.trim().length > 0;
  } catch {
    return false;
  }
}
