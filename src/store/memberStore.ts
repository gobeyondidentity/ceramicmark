import * as fs from 'fs/promises';
import * as path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import type { Author, Member, MembersFile } from '../types.js';

const exec = promisify(execFile);

const COMMENTS_DIR = '.ide-comments';
const MEMBERS_FILE = 'members.json';

export class MemberStore {
  private readonly filePath: string;

  constructor(workspaceRoot: string) {
    this.filePath = path.join(workspaceRoot, COMMENTS_DIR, MEMBERS_FILE);
  }

  async getAll(): Promise<Member[]> {
    try {
      const raw = await fs.readFile(this.filePath, 'utf-8');
      const data = JSON.parse(raw) as MembersFile;
      return data.members ?? [];
    } catch (err: unknown) {
      if (isNodeError(err) && err.code === 'ENOENT') {
        return [];
      }
      throw err;
    }
  }

  /** Adds the current user to the roster if not already present, creating the file if needed. */
  async ensureCurrentUser(author: Author): Promise<void> {
    const members = await this.getAll();
    const exists = members.some((m) => m.email === author.email);
    if (!exists) {
      members.push({ name: author.name, email: author.email });
      await this.write(members);
    }
  }

  /** Auto-discovers contributors from git log and merges them into the roster. */
  async syncFromGitLog(workspaceRoot: string): Promise<void> {
    try {
      const { stdout } = await exec('git', ['log', '--format=%aN|%aE'], { cwd: workspaceRoot });
      const discovered: Member[] = [];
      const seen = new Set<string>();

      for (const line of stdout.split('\n')) {
        const [name, email] = line.split('|').map((s) => s.trim());
        if (!name || !email) continue;
        // Filter bot accounts
        if (email.includes('noreply') || name.includes('[bot]') || email.includes('[bot]')) continue;
        if (seen.has(email)) continue;
        seen.add(email);
        discovered.push({ name, email });
      }

      if (discovered.length === 0) return;

      const existing = await this.getAll();
      const existingEmails = new Set(existing.map((m) => m.email));
      const newMembers = discovered.filter((m) => !existingEmails.has(m.email));

      if (newMembers.length > 0) {
        await this.write([...existing, ...newMembers]);
      }
    } catch {
      // git not available or not a git repo — silently skip
    }
  }

  private async write(members: Member[]): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const data: MembersFile = { version: 1, members };
    await fs.writeFile(this.filePath, JSON.stringify(data, null, 2), 'utf-8');
  }
}

function isNodeError(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && 'code' in err;
}
