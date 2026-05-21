import { AURA_TBL, DECAY } from '../constants';
import type { Post } from '../types';

export function lvl(p: number): string {
  if (p >= 500) return 'LEGENDARY';
  if (p >= 300) return 'RISING';
  if (p >= 100) return 'GLOWING';
  return 'NEWCOMER';
}

export function fmt(m: number): string {
  if (m <= 0) return 'EXPIRED';
  if (m < 60) return `${m}m left`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h}h ${r}m` : `${h}h left`;
}

export function pct(m: number): number {
  return Math.max(0, Math.min(100, (m / 1440) * 100));
}

export function tc(t: string): string {
  const map: Record<string, string> = {
    food: 'tf',
    trade: 'tt',
    hang: 'th',
    uic: 'tu',
    campus: 'tu',
  };
  return map[t] || 'tf';
}

export function now(): string {
  const d = new Date();
  return `${d.getHours()}:${d.getMinutes() < 10 ? '0' : ''}${d.getMinutes()}`;
}

export function auraGiven(
  stars: number,
  pid: string,
  meetCounts: Record<string, number>
): number {
  const b = AURA_TBL[stars] || 0;
  const n = meetCounts[pid] || 0;
  return Math.round(b * DECAY[Math.min(n, 3)]);
}

export function decayNote(pid: string, meetCounts: Record<string, number>): string {
  const n = meetCounts[pid] || 0;
  if (!n) return '';
  if (n === 1) return '2ND MEETUP — 60% AURA';
  if (n === 2) return '3RD MEETUP — 30% AURA';
  return 'REPEAT MEETUP — 10% AURA';
}

export function tagAff(posts: Post[], userIni: string): Record<string, number> {
  const a: Record<string, number> = { food: 0, trade: 0, hang: 0 };
  posts
    .filter((p) => p.i === userIni)
    .forEach((p) =>
      p.tags.forEach((t) => {
        if (a[t] !== undefined) a[t]++;
      })
    );
  posts
    .filter((p) => p.uv === 1)
    .forEach((p) =>
      p.tags.forEach((t) => {
        if (a[t] !== undefined) a[t] += 0.5;
      })
    );
  return a;
}

export function recScore(p: Post, aff: Record<string, number>): number {
  return (
    (p.mins / 1440) * 40 +
    Math.max(0, p.score) * 3 +
    Math.min(p.aura / 100, 5) * 2 +
    p.tags.reduce((s, t) => s + (aff[t] || 0) * 10, 0)
  );
}

export function sortedPosts(
  posts: Post[],
  filter: string,
  userIni: string
): Post[] {
  const aff = tagAff(posts, userIni);
  return [...posts]
    .filter((p) => (filter === 'all' ? true : p.tags.includes(filter)))
    .sort((a, b) => recScore(b, aff) - recScore(a, aff));
}
