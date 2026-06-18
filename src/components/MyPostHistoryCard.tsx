import type { Post } from '../types';
import { fmt, tc } from '../utils/helpers';

interface MyPostHistoryCardProps {
  post: Post;
}

export function MyPostHistoryCard({ post: p }: MyPostHistoryCardProps) {
  const live = !p.expired && p.mins > 0;

  return (
    <div className={`hist-post${live ? ' hist-live' : ' hist-expired'}`}>
      <div className="hist-top">
        <span className={`hist-status${live ? ' on' : ''}`}>
          {live ? fmt(p.mins) : 'expired'}
        </span>
        {p.postedAt && <span className="hist-when">{p.postedAt} ago</span>}
      </div>
      <div className="hist-body">{p.body}</div>
      <div className="hist-meta">
        <div className="hist-tags">
          {p.tags.map((t) => (
            <span key={t} className={`ptag ${tc(t)}`}>
              {t}
            </span>
          ))}
        </div>
        <div className="hist-stats">
          <span>
            <i className="ti ti-arrow-up" /> {p.score}
          </span>
          <span>
            <i className="ti ti-message-circle" /> {p.reps}
          </span>
        </div>
      </div>
      {p.loc && (
        <div className="hist-loc">
          <i className="ti ti-map-pin" style={{ fontSize: 10 }} /> {p.loc}
        </div>
      )}
    </div>
  );
}
