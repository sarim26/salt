export function isSilentFirestoreError(err: unknown): boolean {
  const code = (err as { code?: string }).code || '';
  const msg = err instanceof Error ? err.message : String(err);

  return (
    code === 'permission-denied' ||
    code === 'unauthenticated' ||
    msg.includes('insufficient permissions') ||
    msg.toLowerCase().includes('permission denied')
  );
}

export function firestoreErrorMessage(err: unknown): string | null {
  if (isSilentFirestoreError(err)) return null;

  const code = (err as { code?: string }).code || '';
  const msg = err instanceof Error ? err.message : String(err);

  if (code === 'failed-precondition' && msg.includes('index')) {
    return 'feed loading — try again in a moment';
  }
  return msg || 'something went wrong';
}
