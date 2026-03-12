/** Extract all @Name mentions from a comment body. */
export function parseMentions(body: string): string[] {
  const matches = body.match(/@([^\s@][^@]*?)(?=\s|$|@)/g);
  if (!matches) return [];
  return [...new Set(matches.map((m) => m.slice(1).trim()))];
}
