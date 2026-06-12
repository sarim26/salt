import type { FilterTab } from '../types';

export const AVC = [
  '#E8401A',
  '#1A6B3A',
  '#185FA5',
  '#8B1A5A',
  '#3DA882',
  '#7A3AAD',
  '#A86B1A',
];

export const AURA_TBL: Record<number, number> = {
  1: 10,
  2: 20,
  3: 35,
  4: 50,
  5: 70,
};

export const DECAY = [1, 0.6, 0.3, 0.1];

export const REVIEWER_RWD = 15;

export const ALLOWED_DOMAINS = ['uic.edu', 'illinois.edu', 'mit.edu'] as const;

export const FILTER_TABS: FilterTab[] = ['all', 'food', 'trade', 'hang'];

export const BDG_DEF = [
  { n: 'verified student', c: 'c' as const },
  { n: 'early adopter', c: 't' as const },
  { n: 'first post', c: 'r' as const },
  { n: 'meal trader', c: 't' as const },
  { n: 'connector', c: 'r' as const },
  { n: 'good vibes', c: 'c' as const },
];
