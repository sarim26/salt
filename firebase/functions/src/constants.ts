export const ALLOWED_DOMAINS = ['uic.edu', 'illinois.edu', 'mit.edu'] as const;

export type AllowedDomain = (typeof ALLOWED_DOMAINS)[number];

export const SCHOOL_META: Record<
  AllowedDomain,
  { name: string; city: string; defaultSchoolLabel: string }
> = {
  'uic.edu': { name: 'UIC', city: 'Chicago', defaultSchoolLabel: 'UIC · Student' },
  'illinois.edu': {
    name: 'UIUC',
    city: 'Champaign',
    defaultSchoolLabel: 'UIUC · Student',
  },
  'mit.edu': { name: 'MIT', city: 'Cambridge', defaultSchoolLabel: 'MIT · Student' },
};

export const AURA_TBL: Record<number, number> = {
  1: 20,
  2: -10,
  3: 5,
  4: 10,
  5: 20,
};

export const DECAY = [1, 0.6, 0.3, 0.1];

export const STARTING_AURA = 100;
export const POST_AURA_REWARD = 20;

export function auraGiven(stars: number, meetCount: number): number {
  const b = AURA_TBL[stars] || 0;
  return Math.round(b * DECAY[Math.min(meetCount, 3)]);
}

export function emailDomain(email: string): string | null {
  const parts = email.toLowerCase().trim().split('@');
  return parts.length === 2 ? parts[1] : null;
}

export function isAllowedDomain(domain: string): domain is AllowedDomain {
  return (ALLOWED_DOMAINS as readonly string[]).includes(domain);
}

export function initialsFromEmail(email: string): string {
  const local = email.split('@')[0] || 'U';
  const parts = local.split(/[._-]/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return local.slice(0, 2).toUpperCase();
}

export function displayNameFromEmail(email: string): string {
  const local = email.split('@')[0] || 'Student';
  return local
    .split(/[._-]/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');
}
