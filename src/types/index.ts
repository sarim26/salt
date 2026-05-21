export type Screen =
  | 'login'
  | 'feed'
  | 'explore'
  | 'chats'
  | 'chat-detail'
  | 'profile';

export type FilterTab = 'all' | 'food' | 'trade' | 'hang' | 'uic';

export interface Post {
  id: number;
  n: string;
  i: string;
  av: number;
  aura: number;
  body: string;
  tags: string[];
  loc: string | null;
  mins: number;
  score: number;
  uv: number;
  reps: number;
  met: boolean;
}

export interface ChatMessage {
  me: boolean;
  text: string;
  time: string;
}

export interface Chat {
  id: number;
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
}

export interface BadgeDef {
  n: string;
  c: 'r' | 't' | 'c';
}
