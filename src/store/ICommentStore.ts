import type { Comment } from '../types.js';

/**
 * Storage abstraction for comments.
 * Phase 1: FileStore (local JSON in repo)
 * Phase 2: SupabaseStore (cloud sync + realtime)
 */
export interface ICommentStore {
  /** Load all comments */
  getAll(): Promise<Comment[]>;

  /** Persist a new comment */
  add(comment: Comment): Promise<void>;

  /** Update an existing comment (replies, status changes) */
  update(comment: Comment): Promise<void>;
}
