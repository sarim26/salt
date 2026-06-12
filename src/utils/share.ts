import type { Post } from '../types';

export async function sharePost(
  post: Post,
  schoolName: string
): Promise<'shared' | 'copied'> {
  const text = `${post.n.toUpperCase()} · ${schoolName}\n${post.body}${
    post.loc ? `\n📍 ${post.loc}` : ''
  }`;
  const url = window.location.origin || 'https://app.salt-usa.com';

  if (navigator.share) {
    try {
      await navigator.share({
        title: 'SALT',
        text,
        url,
      });
      return 'shared';
    } catch (e) {
      if ((e as Error).name === 'AbortError') throw e;
    }
  }

  await navigator.clipboard.writeText(`${text}\n\n${url}`);
  return 'copied';
}
