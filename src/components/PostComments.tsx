import { useEffect, useState } from 'react';
import { Avatar } from './Avatar';
import { useApp } from '../context/AppContext';
import type { Post } from '../types';

interface PostCommentsProps {
  post: Post;
  currentUid?: string | null;
}

export function PostComments({ post, currentUid }: PostCommentsProps) {
  const {
    commentsForPost,
    subscribePostComments,
    addPostComment,
    addParticipant,
    removeParticipant,
    confirmMeetingDone,
  } = useApp();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const postId = String(post.id);
  const isHost = Boolean(currentUid && post.authorUid === currentUid);
  const comments = commentsForPost[postId] ?? [];
  const filled = post.participantUids.length;
  const capacity = post.capacity;
  const slotPct = capacity > 0 ? Math.round((filled / capacity) * 100) : 0;
  const isParticipant = Boolean(currentUid && post.participantUids.includes(currentUid));

  useEffect(() => {
    if (!open) return;
    return subscribePostComments(postId);
  }, [open, postId, subscribePostComments]);

  const send = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    try {
      await addPostComment(postId, text);
      setText('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pcomments">
      <div className="slot-bar-wrap">
        <div className="slot-bar-lbl">
          <span>
            {filled}/{capacity} spots
          </span>
          {post.meetingDone && <span className="slot-done">meeting done</span>}
        </div>
        <div className="slot-bar">
          <div className="slot-fill" style={{ width: `${slotPct}%` }} />
        </div>
        {post.participantUids.length > 0 && (
          <div className="slot-names">
            {post.participantUids.map((uid) => (
              <span key={uid} className="slot-chip">
                {(post.participantNames[uid] || 'student').toUpperCase()}
              </span>
            ))}
          </div>
        )}
      </div>

      {isHost && !post.meetingDone && post.participantUids.length > 0 && (
        <button
          type="button"
          className="host-done-btn"
          onClick={() => void confirmMeetingDone(postId)}
        >
          CONFIRM MEETING DONE
        </button>
      )}

      <button type="button" className="cbtn" onClick={() => setOpen((v) => !v)}>
        <i className="ti ti-message-circle" />
        {open ? 'hide' : 'show'} comments ({post.reps})
      </button>

      {open && (
        <div className="cthread">
          {comments.length === 0 ? (
            <div className="cempty">be first to comment — host picks who joins</div>
          ) : (
            comments.map((c) => {
              const added = post.participantUids.includes(c.authorUid);
              const canAdd =
                isHost &&
                !post.meetingDone &&
                !added &&
                c.authorUid !== post.authorUid &&
                filled < capacity;
              const canRemove = isHost && !post.meetingDone && added;

              return (
                <div key={c.id} className="citem">
                  <Avatar
                    initials={c.i}
                    photoUrl={c.photoUrl}
                    colorIndex={c.av}
                    size="sm"
                    className="cavi-sm"
                  />
                  <div className="cbody">
                    <div className="cname">
                      {c.n.toUpperCase()}
                      {added && <span className="cjoined">joined</span>}
                    </div>
                    <div className="ctext">{c.text}</div>
                    <div className="cmeta">
                      <span>{c.time}</span>
                      {canAdd && (
                        <button
                          type="button"
                          className="cact add"
                          onClick={() => void addParticipant(postId, c.authorUid, c.n)}
                        >
                          + add
                        </button>
                      )}
                      {canRemove && (
                        <button
                          type="button"
                          className="cact rem"
                          onClick={() => void removeParticipant(postId, c.authorUid)}
                        >
                          remove
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {currentUid && !isHost && !isParticipant && !post.meetingDone && (
            <div className="ccompose">
              <input
                className="cinp"
                placeholder="say you're down to meet..."
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void send()}
              />
              <button type="button" className="csend" onClick={() => void send()} disabled={busy}>
                post
              </button>
            </div>
          )}
          {isHost && (
            <div className="chost-note">you're the host — add people from comments above</div>
          )}
        </div>
      )}
    </div>
  );
}
