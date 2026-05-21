import { AVC } from '../constants';
import type { Post } from '../types';
import { fmt, lvl, pct, tc } from '../utils/helpers';

interface PostCardProps {
  post: Post;
  schoolName: string;
  showRec?: boolean;
  compact?: boolean;
  onVote: (id: number, d: number) => void;
  onMeetUp: (id: number) => void;
  onOpenChat: (id: number) => void;
}

export function PostCard({
  post: p,
  schoolName,
  showRec,
  compact,
  onVote,
  onMeetUp,
  onOpenChat,
}: PostCardProps) {
  const u = p.mins < 120;
  const sc = p.score > 0 ? 'pos' : p.score < 0 ? 'neg' : '';

  if (compact) {
    return (
      <div className="post" style={{ margin: '0 14px 8px' }}>
        <div className="post-inner">
          <div className="vcol" style={{ padding: '10px 8px 10px 10px' }}>
            <div className={`vscore${p.score > 0 ? ' pos' : ''}`}>{p.score}</div>
          </div>
          <div className="pmain" style={{ padding: '10px 12px 10px 4px' }}>
            <div className="pname" style={{ marginBottom: 4 }}>
              {p.n.toUpperCase()}
              <span className="ab">✦ {p.aura}</span>
            </div>
            <div className="pbody">{p.body}</div>
            <div className="ptags">
              {p.tags.map((t) => (
                <span key={t} className={`ptag ${tc(t)}`}>
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {showRec && (
        <div className="rec-lbl">
          <i className="ti ti-sparkles" />
          recommended for you
        </div>
      )}
      <div className={`post${u ? ' hot' : ''}`} id={`p${p.id}`}>
        <div className="tbar">
          <div className="tfill" style={{ width: `${pct(p.mins)}%` }} />
        </div>
        <div className="post-inner">
          <div className="vcol">
            <button
              type="button"
              className={`vbtn${p.uv === 1 ? ' up-on' : ''}`}
              onClick={() => onVote(p.id, 1)}
              aria-label="upvote"
            >
              <i className="ti ti-arrow-up" />
            </button>
            <div className={`vscore${sc ? ` ${sc}` : ''}`}>{p.score}</div>
            <button
              type="button"
              className={`vbtn${p.uv === -1 ? ' dn-on' : ''}`}
              onClick={() => onVote(p.id, -1)}
              aria-label="downvote"
            >
              <i className="ti ti-arrow-down" />
            </button>
          </div>
          <div className="pmain">
            <div className="ptop">
              <div className="pav" style={{ background: AVC[p.av] }}>
                {p.i}
              </div>
              <div className="pmeta">
                <div className="pname">
                  {p.n.toUpperCase()}
                  <span className="ab">✦ {p.aura}</span>
                </div>
                <div className="psub">
                  {lvl(p.aura)} · {schoolName}
                </div>
              </div>
              <div className={`ptimer${u ? ' urg' : ''}`}>
                <i className="ti ti-clock" style={{ fontSize: 10 }} /> {fmt(p.mins)}
              </div>
            </div>
            <div className="pbody">{p.body}</div>
            <div className="ptags">
              {p.tags.map((t) => (
                <span key={t} className={`ptag ${tc(t)}`}>
                  {t}
                </span>
              ))}
            </div>
            {p.loc && (
              <div className="ploc">
                <i className="ti ti-map-pin" style={{ fontSize: 10 }} /> {p.loc}
              </div>
            )}
            <div className="pacts">
              <button type="button" className="abtn" onClick={() => onOpenChat(p.id)}>
                <i className="ti ti-message-circle" />
                {p.reps} replies
              </button>
              <button type="button" className="abtn">
                <i className="ti ti-share" />
              </button>
              <button
                type="button"
                className={`mbtn${p.met ? ' active' : ''}`}
                onClick={() => onMeetUp(p.id)}
              >
                {p.met ? 'RATE AURA ✦' : 'MEET UP'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
