import * as fs from 'fs/promises';
import * as path from 'path';
import type { Comment, CommentsFile } from '../types.js';
import type { ICommentStore } from './ICommentStore.js';

const COMMENTS_DIR = '.ide-comments';
const COMMENTS_FILE = 'comments.json';

export class FileStore implements ICommentStore {
  private readonly filePath: string;

  constructor(workspaceRoot: string) {
    this.filePath = path.join(workspaceRoot, COMMENTS_DIR, COMMENTS_FILE);
  }

  async getAll(): Promise<Comment[]> {
    try {
      const raw = await fs.readFile(this.filePath, 'utf-8');
      const data = JSON.parse(raw) as CommentsFile;
      return data.comments ?? [];
    } catch (err: unknown) {
      // File doesn't exist yet — that's fine, return empty
      if (isNodeError(err) && err.code === 'ENOENT') {
        return [];
      }
      throw err;
    }
  }

  async add(comment: Comment): Promise<void> {
    const comments = await this.getAll();
    comments.push(comment);
    await this.write(comments);
  }

  async update(comment: Comment): Promise<void> {
    const comments = await this.getAll();
    const idx = comments.findIndex((c) => c.id === comment.id);
    if (idx === -1) {
      throw new Error(`Comment ${comment.id} not found`);
    }
    comments[idx] = comment;
    await this.write(comments);
  }

  async delete(id: string): Promise<void> {
    const comments = await this.getAll();
    await this.write(comments.filter((c) => c.id !== id));
  }

  private async write(comments: Comment[]): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const data: CommentsFile = { version: 1, comments };
    await fs.writeFile(this.filePath, JSON.stringify(data, null, 2), 'utf-8');
  }
}

function isNodeError(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && 'code' in err;
}
