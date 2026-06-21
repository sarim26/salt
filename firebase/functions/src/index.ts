import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';
import { beforeUserCreated } from 'firebase-functions/v2/identity';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as functions from 'firebase-functions/v1';
import {
  auraGiven,
  displayNameFromEmail,
  emailDomain,
  initialsFromEmail,
  isAllowedDomain,
  SCHOOL_META,
} from './constants.js';

admin.initializeApp();
const db = admin.firestore();

export const onPostCreate = onDocumentCreated('posts/{postId}', async (event) => {
  const snap = event.data;
  if (!snap) return;
  const post = snap.data();
  if (!post?.authorUid) return;

  const uid = post.authorUid as string;
  const userRef = db.doc(`users/${uid}`);

  await db.runTransaction(async (tx) => {
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists) return;
    const data = userSnap.data()!;
    const postCount = (data.postCount || 0) + 1;
    const badges = [...(data.badges || [])];
    if (postCount === 1 && !badges.includes('first post')) {
      badges.push('first post');
    }
    tx.update(userRef, {
      postCount,
      badges,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    if (postCount === 1) {
      tx.set(db.collection(`users/${uid}/auraEvents`).doc(), {
        ico: 'ti-award',
        txt: 'badge unlocked: first post',
        pts: '🏅',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  });
});

export const beforeCreate = beforeUserCreated((event) => {
  const email = event.data?.email?.toLowerCase().trim();
  if (!email) {
    throw new HttpsError('invalid-argument', 'Email is required.');
  }
  const domain = emailDomain(email);
  if (!domain || !isAllowedDomain(domain)) {
    throw new HttpsError(
      'invalid-argument',
      'Only uic.edu, illinois.edu, and mit.edu emails are allowed.'
    );
  }
});

export const onAuthUserCreate = functions.auth.user().onCreate(async (user) => {
  const email = user.email?.toLowerCase().trim();
  if (!email) return;

  const domain = emailDomain(email);
  if (!domain || !isAllowedDomain(domain)) return;

  await admin.auth().setCustomUserClaims(user.uid, { schoolDomain: domain });

  const meta = SCHOOL_META[domain];
  const now = admin.firestore.FieldValue.serverTimestamp();

  await db.doc(`users/${user.uid}`).set({
    email,
    displayName: displayNameFromEmail(email),
    initials: initialsFromEmail(email),
    schoolDomain: domain,
    schoolLabel: meta.defaultSchoolLabel,
    aura: 100,
    postCount: 0,
    meetCount: 0,
    meetCounts: {},
    badges: ['verified student'],
    avatarIndex: 0,
    createdAt: now,
    updatedAt: now,
  });
});

export const onVoteWrite = onDocumentWritten(
  'posts/{postId}/votes/{voteUid}',
  async (event) => {
    const postId = event.params.postId;
    const votesSnap = await db.collection(`posts/${postId}/votes`).get();
    let score = 0;
    votesSnap.forEach((doc) => {
      score += doc.data().value as number;
    });
    await db.doc(`posts/${postId}`).update({ score });
  }
);

export const submitRating = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Sign in required.');
  }
  if (!request.auth.token.email_verified) {
    throw new HttpsError('failed-precondition', 'Verify your email first.');
  }

  const { postId, stars } = request.data as { postId?: string; stars?: number };
  if (!postId || typeof stars !== 'number' || stars < 1 || stars > 5) {
    throw new HttpsError('invalid-argument', 'Invalid rating payload.');
  }

  const reviewerUid = request.auth.uid;
  const ratingId = `${reviewerUid}_${postId}`;
  const ratingRef = db.doc(`ratings/${ratingId}`);

  const existing = await ratingRef.get();
  if (existing.exists) {
    throw new HttpsError('already-exists', 'You already rated this meetup.');
  }

  const postSnap = await db.doc(`posts/${postId}`).get();
  if (!postSnap.exists) {
    throw new HttpsError('not-found', 'Post not found.');
  }

  const post = postSnap.data()!;
  const schoolDomain = request.auth.token.schoolDomain as string;
  if (post.schoolDomain !== schoolDomain) {
    throw new HttpsError('permission-denied', 'Wrong campus.');
  }

  const targetUid = post.authorUid as string;
  if (targetUid === reviewerUid) {
    throw new HttpsError('invalid-argument', 'Cannot rate yourself.');
  }

  const reviewerRef = db.doc(`users/${reviewerUid}`);
  const targetRef = db.doc(`users/${targetUid}`);

  const given = await db.runTransaction(async (tx) => {
    const targetSnap = await tx.get(targetRef);
    const reviewerSnap = await tx.get(reviewerRef);
    if (!targetSnap.exists || !reviewerSnap.exists) {
      throw new HttpsError('not-found', 'User profile missing.');
    }

    const targetData = targetSnap.data()!;
    const reviewerData = reviewerSnap.data()!;
    const reviewerMeetCounts = (reviewerData.meetCounts || {}) as Record<string, number>;
    const prior = reviewerMeetCounts[targetUid] || 0;
    const auraPts = auraGiven(stars, prior);

    reviewerMeetCounts[targetUid] = prior + 1;

    const reviewerBadges = [...(reviewerData.badges || [])];
    const reviewerMeetCount = (reviewerData.meetCount || 0) + 1;

    if (reviewerMeetCount >= 3 && !reviewerBadges.includes('connector')) {
      reviewerBadges.push('connector');
    }

    const now = admin.firestore.FieldValue.serverTimestamp();

    tx.set(ratingRef, {
      reviewerUid,
      targetUid,
      postId,
      stars,
      auraGiven: auraPts,
      reviewerReward: 0,
      schoolDomain,
      createdAt: now,
    });

    tx.update(targetRef, {
      aura: (targetData.aura || 0) + auraPts,
      updatedAt: now,
    });

    tx.update(reviewerRef, {
      meetCount: reviewerMeetCount,
      meetCounts: reviewerMeetCounts,
      badges: reviewerBadges,
      updatedAt: now,
    });

    tx.set(db.collection(`users/${targetUid}/auraEvents`).doc(), {
      ico: 'ti-star',
      txt: `rated by peer — ${stars}★ · +${auraPts} aura`,
      pts: `+${auraPts}`,
      createdAt: now,
    });

    tx.set(db.collection(`users/${reviewerUid}/auraEvents`).doc(), {
      ico: 'ti-star',
      txt: `rated ${post.authorName} — ${stars}★ · gave ${auraPts} aura`,
      pts: auraPts >= 0 ? `+${auraPts}` : `${auraPts}`,
      createdAt: now,
    });

    if (reviewerMeetCount >= 3 && !reviewerData.badges?.includes('connector')) {
      tx.set(db.collection(`users/${reviewerUid}/auraEvents`).doc(), {
        ico: 'ti-award',
        txt: 'badge unlocked: connector',
        pts: '🏅',
        createdAt: now,
      });
    }

    return auraPts;
  });

  return { auraGiven: given };
});

export const expirePosts = onSchedule('every 60 minutes', async () => {
  const snap = await db
    .collection('posts')
    .where('expiresAt', '<=', admin.firestore.Timestamp.now())
    .limit(500)
    .get();

  const batch = db.batch();
  snap.docs.forEach((doc) => batch.delete(doc.ref));
  if (!snap.empty) await batch.commit();
});
