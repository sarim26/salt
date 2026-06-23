import type { Timestamp } from 'firebase/firestore';

export interface UserProfile {
  email: string;
  displayName: string;
  initials: string;
  schoolDomain: string;
  schoolLabel: string;
  aura: number;
  postCount: number;
  meetCount: number;
  meetCounts: Record<string, number>;
  badges: string[];
  avatarIndex: number;
  photoUrl: string | null;
  referralCount: number;
  referredByEmail: string | null;
  referredByUid: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface PostDoc {
  authorUid: string;
  schoolDomain: string;
  body: string;
  tags: string[];
  loc: string | null;
  score: number;
  replyCount: number;
  createdAt: Timestamp;
  expiresAt: Timestamp;
  authorName: string;
  authorInitials: string;
  authorAura: number;
  authorPhotoUrl?: string | null;
  avatarIndex: number;
  capacity?: number;
  participantUids?: string[];
  participantNames?: Record<string, string>;
  meetingDone?: boolean;
}

export interface CommentDoc {
  authorUid: string;
  text: string;
  authorName: string;
  authorInitials: string;
  authorPhotoUrl?: string | null;
  avatarIndex: number;
  parentId?: string | null;
  replyToName?: string | null;
  createdAt: Timestamp;
}

export interface VoteDoc {
  value: 1 | -1;
  updatedAt: Timestamp;
}

export interface ChatDoc {
  schoolDomain: string;
  participantUids: [string, string];
  lastPreview: string;
  lastAt: Timestamp;
  unread: Record<string, boolean>;
  peerNames: Record<string, string>;
  peerInitials: Record<string, string>;
  peerAuras: Record<string, number>;
  peerAvatars: Record<string, number>;
  sourcePostId?: string | null;
}

export interface MessageDoc {
  senderUid: string;
  text: string;
  createdAt: Timestamp;
}

export interface AuraEventDoc {
  ico: string;
  txt: string;
  pts: string;
  createdAt: Timestamp;
}

export interface RatingDoc {
  reviewerUid: string;
  targetUid: string;
  postId: string;
  stars: number;
  auraGiven: number;
  reviewerReward: number;
  schoolDomain: string;
  applied: boolean;
  vibes?: string[];
  createdAt: Timestamp;
}

export type MeetRequestStatus = 'pending' | 'confirmed' | 'declined';

export interface MeetRequestDoc {
  postId: string;
  requesterUid: string;
  posterUid: string;
  requesterName: string;
  requesterInitials: string;
  schoolDomain: string;
  postPreview: string;
  status: MeetRequestStatus;
  createdAt: Timestamp;
  confirmedAt?: Timestamp;
}
