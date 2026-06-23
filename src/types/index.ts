export type AppMode = 'live' | null;

export type Screen = 'login' | 'feed' | 'explore' | 'profile';

export type FilterTab = 'all' | 'food' | 'trade' | 'hang';

export interface PostComment {
  id: string;
  authorUid: string;
  text: string;
  n: string;
  i: string;
  av: number;
  photoUrl: string | null;
  time: string;
  parentId: string | null;
  replyToName: string | null;
}

/** @deprecated legacy meet-request type — kept for cleanup service */
export interface IncomingMeetRequest {
  id: string;
  postId: string;
  requesterUid: string;
  requesterName: string;
  requesterInitials: string;
  postPreview: string;
  time: string;
}

export interface Post {
  id: string | number;
  authorUid?: string;
  n: string;
  i: string;
  av: number;
  photoUrl?: string | null;
  aura: number;
  body: string;
  tags: string[];
  loc: string | null;
  mins: number;
  score: number;
  uv: number;
  reps: number;
  capacity: number;
  participantUids: string[];
  participantNames: Record<string, string>;
  meetingDone: boolean;
  expired?: boolean;
  postedAt?: string;
}

export interface ChatMessage {
  me: boolean;
  text: string;
  time: string;
}

export interface Chat {
  id: string | number;
  peerUid?: string;
  sourcePostId?: string | null;
  n: string;
  i: string;
  av: number;
  aura: number;
  preview: string;
  time: string;
  unread: boolean;
  msgs: ChatMessage[];
}

export interface LeaderboardUser {
  n: string;
  i: string;
  av: number;
  aura: number;
}

export interface AuraHistoryItem {
  ico: string;
  txt: string;
  pts: string;
  t: string;
}

export interface UniversityData {
  name: string;
  city: string;
  ini: string;
  full: string;
  school: string;
  posts: Post[];
  chats: Chat[];
  lb: LeaderboardUser[];
}

export interface User extends UniversityData {
  domain: string;
  photoUrl?: string | null;
}

export interface BadgeDef {
  n: string;
  c: 'r' | 't' | 'c';
}
