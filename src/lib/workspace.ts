const KEY = "docmind-workspace-id";

/** Anonymous per-browser workspace id. Call only in effects/handlers. */
export function getWorkspaceId(): string {
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
}
