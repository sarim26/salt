import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { REVIEWER_RWD } from '../constants';
import { db } from '../lib/firebase';
import type { Post, UserProfile } from '../types';
import { auraGiven } from '../utils/helpers';

export async function submitRating(
  reviewerUid: string,
  profile: UserProfile,
  postId: string,
  post: Post,
  stars: number
): Promise<{ auraGiven: number; reviewerReward: number }> {
  if (!db) throw new Error('Firebase not configured');
  if (!post.authorUid) throw new Error('Invalid post');

  const targetUid = post.authorUid;
  const ratingId = `${reviewerUid}_${postId}`;
  const ratingRef = doc(db, 'ratings', ratingId);
  const existing = await getDocs(
    query(collection(db, 'ratings'), where('__name__', '==', ratingId))
  );
  if (!existing.empty) {
    throw new Error('You already rated this meetup');
  }

  const prior = profile.meetCounts?.[targetUid] || 0;
  const given = auraGiven(stars, targetUid, profile.meetCounts || {});

  const meetCounts = { ...(profile.meetCounts || {}) };
  meetCounts[targetUid] = prior + 1;

  const reviewerMeetCount = (profile.meetCount || 0) + 1;
  const badges = [...(profile.badges || [])];
  if (reviewerMeetCount >= 3 && !badges.includes('connector')) {
    badges.push('connector');
  }

  const batch = writeBatch(db);

  batch.set(ratingRef, {
    reviewerUid,
    targetUid,
    postId,
    stars,
    auraGiven: given,
    reviewerReward: REVIEWER_RWD,
    schoolDomain: profile.schoolDomain,
    applied: false,
    createdAt: serverTimestamp(),
  });

  batch.update(doc(db, 'users', reviewerUid), {
    aura: (profile.aura || 0) + REVIEWER_RWD,
    meetCount: reviewerMeetCount,
    meetCounts,
    badges,
    updatedAt: serverTimestamp(),
  });

  const reviewerEventRef = doc(collection(db, 'users', reviewerUid, 'auraEvents'));
  batch.set(reviewerEventRef, {
    ico: 'ti-star',
    txt: `rated ${post.n} — ${stars}★ · gave ${given} aura`,
    pts: `+${REVIEWER_RWD}`,
    createdAt: serverTimestamp(),
  });

  if (reviewerMeetCount >= 3 && !(profile.badges || []).includes('connector')) {
    const badgeRef = doc(collection(db, 'users', reviewerUid, 'auraEvents'));
    batch.set(badgeRef, {
      ico: 'ti-award',
      txt: 'badge unlocked: connector',
      pts: '🏅',
      createdAt: serverTimestamp(),
    });
  }

  await batch.commit();

  return { auraGiven: given, reviewerReward: REVIEWER_RWD };
}

export async function applyPendingRatings(targetUid: string): Promise<number> {
  if (!db) return 0;

  const q = query(
    collection(db, 'ratings'),
    where('targetUid', '==', targetUid),
    where('applied', '==', false)
  );
  const snap = await getDocs(q);
  if (snap.empty) return 0;

  const userRef = doc(db, 'users', targetUid);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) return 0;

  let aura = userSnap.data().aura || 0;
  const batch = writeBatch(db);

  snap.docs.forEach((ratingDoc) => {
    const r = ratingDoc.data();
    aura += r.auraGiven || 0;
    batch.update(ratingDoc.ref, { applied: true });
    const eventRef = doc(collection(db, 'users', targetUid, 'auraEvents'));
    batch.set(eventRef, {
      ico: 'ti-star',
      txt: `rated by peer — ${r.stars}★ · +${r.auraGiven} aura`,
      pts: `+${r.auraGiven}`,
      createdAt: serverTimestamp(),
    });
  });

  batch.update(userRef, { aura, updatedAt: serverTimestamp() });
  await batch.commit();
  return snap.size;
}

import { getDoc } from 'firebase/firestore';
