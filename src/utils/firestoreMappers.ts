import { ALLOWED_DOMAINS } from '../constants';

export { ALLOWED_DOMAINS };

export function emailDomain(email: string): string | null {
  const parts = email.toLowerCase().trim().split('@');
  return parts.length === 2 ? parts[1] : null;
}

export function isAllowedDomain(domain: string): boolean {
  return ALLOWED_DOMAINS.includes(domain as (typeof ALLOWED_DOMAINS)[number]);
}

export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  if (parts.length === 1 && parts[0].length >= 2) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return 'ST';
}

export function initialsFromEmail(email: string): string {
  return initialsFromName(displayNameFromEmail(email));
}

export function displayNameFromEmail(email: string): string {
  const local = email.split('@')[0] || 'Student';
  return local
    .split(/[._-]/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');
}

export function chatIdFor(schoolDomain: string, uidA: string, uidB: string): string {
  const sorted = [uidA, uidB].sort();
  return `${schoolDomain}_${sorted[0]}_${sorted[1]}`;
}

export function expiresAtToMins(expiresAtMs: number): number {
  const diff = expiresAtMs - Date.now();
  return Math.max(0, Math.floor(diff / 60000));
}

export function formatRelativeTime(date: Date): string {
  const mins = Math.floor((Date.now() - date.getTime()) / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export function formatMessageTime(date: Date): string {
  return `${date.getHours()}:${date.getMinutes() < 10 ? '0' : ''}${date.getMinutes()}`;
}
