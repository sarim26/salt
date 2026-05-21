import { httpsCallable } from 'firebase/functions';
import { functions } from '../lib/firebase';

export async function submitRating(postId: string, stars: number): Promise<{
  auraGiven: number;
  reviewerReward: number;
}> {
  if (!functions) throw new Error('Firebase not configured');
  const fn = httpsCallable<{ postId: string; stars: number }, {
    auraGiven: number;
    reviewerReward: number;
  }>(functions, 'submitRating');
  const result = await fn({ postId, stars });
  return result.data;
}
