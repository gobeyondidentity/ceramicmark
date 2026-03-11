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
