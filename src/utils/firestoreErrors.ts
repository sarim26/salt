export function firestoreErrorMessage(err: unknown): string {
  const code = (err as { code?: string }).code || '';
  const msg = err instanceof Error ? err.message : String(err);

  if (code === 'permission-denied' || msg.includes('insufficient permissions')) {
    return 'permission denied — sign out and sign in again; disable ad blockers for this site';
  }
  if (code === 'unauthenticated') {
    return 'session expired — sign in again';
  }
  if (code === 'failed-precondition' && msg.includes('index')) {
    return 'database index missing — contact support';
  }
  return msg || 'something went wrong';
}
