/**
 * A React key that changes when a server-loaded list changes. Next.js keeps visited screens
 * alive, so a client list seeded from server data would otherwise keep showing the old list.
 */
export function listKey<T>(rows: T[], part: (row: T) => string) {
  let h = 0;
  for (const r of rows) for (const ch of part(r)) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return `${rows.length}:${h}`;
}
