import { Avatar } from './Avatar';
import { PostComments } from './PostComments';
import type { Post } from '../types';
import { fmt, lvl, pct, tc } from '../utils/helpers';

interface PostCardProps {
  post: Post;
  schoolName: string;
  currentUid?: string | null;
  showRec?: boolean;
  compact?: boolean;
  ratedKeys: Set<string>;
  onVote: (id: string | number, d: number) => void;
  onRatePerson: (postId: string, targetUid: string, targetName: string) => void;
  onShare: (id: string | number) => void;
}

export function PostCard({
  post: p,
  schoolName,
  currentUid,
  showRec,
  compact,
  ratedKeys,
  onVote,
  onRatePerson,
  onShare,
}: PostCardProps) {
  const u = p.mins < 120;
  const sc = p.score > 0 ? 'pos' : p.score < 0 ? 'neg' : '';
  const isOwnPost = Boolean(currentUid && p.authorUid && currentUid === p.authorUid);
  const postId = String(p.id);

  const rateTargets =
    p.meetingDone && currentUid
      ? [
          ...(p.authorUid && p.authorUid !== currentUid
            ? [{ uid: p.authorUid, name: p.n }]
            : []),
          ...p.participantUids
            .filter((uid) => uid !== currentUid)
            .map((uid) => ({ uid, name: p.participantNames[uid] || 'STUDENT' })),
        ].filter((t) => !ratedKeys.has(`${postId}_${t.uid}`))
      : [];

  const inParty =
    Boolean(currentUid) &&
    (isOwnPost || p.participantUids.includes(currentUid!));

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
              <Avatar
                initials={p.i}
                photoUrl={p.photoUrl}
                colorIndex={p.av}
                size="md"
                className="pav"
              />
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

            <PostComments post={p} currentUid={currentUid} />

            <div className="pacts">
              <button type="button" className="abtn" onClick={() => onShare(p.id)} aria-label="share">
                <i className="ti ti-share" />
              </button>
              {isOwnPost ? (
                <span className="mbtn mbtn-own">YOUR POST</span>
              ) : inParty && p.meetingDone && rateTargets.length > 0 ? (
                <div className="rate-btns">
                  {rateTargets.map((t) => (
                    <button
                      key={t.uid}
                      type="button"
                      className="mbtn mbtn-ready"
                      onClick={() => onRatePerson(postId, t.uid, t.name)}
                    >
                      RATE {t.name.split(' ')[0].toUpperCase()}
                    </button>
                  ))}
                </div>
              ) : inParty && p.meetingDone && rateTargets.length === 0 ? (
                <span className="mbtn mbtn-rated">RATED ✓</span>
              ) : isParticipant(currentUid, p) ? (
                <span className="mbtn mbtn-pending">JOINED — WAITING</span>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function isParticipant(uid: string | null | undefined, p: Post): boolean {
  return Boolean(uid && p.participantUids.includes(uid));
}
