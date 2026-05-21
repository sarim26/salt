import type { CSSProperties } from 'react';
import { AVC } from '../constants';
import type { LeaderboardUser } from '../types';
import { lvl } from '../utils/helpers';

interface LeaderboardCardProps {
  user: LeaderboardUser;
  rank?: number;
  schoolName: string;
  style?: CSSProperties;
}

export function LeaderboardCard({ user: u, rank, schoolName, style }: LeaderboardCardProps) {
  return (
    <div className="ucard" style={style}>
      {rank != null && (
        <div
          style={{
            fontFamily: 'var(--fh)',
            fontSize: 16,
            fontWeight: 900,
            color: 'var(--muted)',
            width: 20,
            textAlign: 'center',
          }}
        >
          {rank}
        </div>
      )}
      <div className="ucavi" style={{ background: AVC[u.av] }}>
        {u.i}
      </div>
      <div className="ucinfo">
        <div className="ucname">{u.n.toUpperCase()}</div>
        <div className="ucsub">
          {lvl(u.aura)} · {schoolName}
        </div>
      </div>
      <div className="ucaura">✦ {u.aura}</div>
    </div>
  );
}
