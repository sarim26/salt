import { useEffect, useState } from 'react';
import { Avatar } from './Avatar';
import { useApp } from '../context/AppContext';
import { threadComments } from '../services/comments';
import type { Post, PostComment } from '../types';

interface PostCommentsProps {
  post: Post;
  currentUid?: string | null;
}

interface ReplyTarget {
  id: string;
  name: string;
}

function CommentRow({
  c,
  post,
  isHost,
  filled,
  capacity,
  canReply,
  onReply,
  addParticipant,
  removeParticipant,
}: {
  c: PostComment;
  post: Post;
  isHost: boolean;
  filled: number;
  capacity: number;
  canReply: boolean;
  onReply: (target: ReplyTarget) => void;
  addParticipant: (postId: string, uid: string, name: string) => Promise<void>;
  removeParticipant: (postId: string, uid: string) => Promise<void>;
}) {
  const postId = String(post.id);
  const isReply = Boolean(c.parentId);
  const added = post.participantUids.includes(c.authorUid);
  const canAdd =
    isHost &&
    !post.meetingDone &&
    !isReply &&
    !added &&
    c.authorUid !== post.authorUid &&
    filled < capacity;
  const canRemove = isHost && !post.meetingDone && added;

  return (
    <div className={`citem${isReply ? ' citem-reply' : ''}`}>
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
        {c.replyToName && (
          <div className="creply-to">
            replying to <span>{c.replyToName.toUpperCase()}</span>
          </div>
        )}
        <div className="ctext">{c.text}</div>
        <div className="cmeta">
          <span>{c.time}</span>
          {canReply && (
            <button type="button" className="cact reply" onClick={() => onReply({ id: c.id, name: c.n })}>
              reply
            </button>
          )}
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
  const [replyTo, setReplyTo] = useState<ReplyTarget | null>(null);

  const postId = String(post.id);
  const isHost = Boolean(currentUid && post.authorUid === currentUid);
  const comments = commentsForPost[postId] ?? [];
  const threads = threadComments(comments);
  const filled = post.participantUids.length;
  const capacity = post.capacity;
  const slotPct = capacity > 0 ? Math.round((filled / capacity) * 100) : 0;
  const canCompose = Boolean(currentUid && !post.meetingDone);
  const canReply = canCompose;

  useEffect(() => {
    if (!open) return;
    return subscribePostComments(postId);
  }, [open, postId, subscribePostComments]);

  const send = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    try {
      await addPostComment(postId, text, replyTo?.id ?? null, replyTo?.name ?? null);
      setText('');
      setReplyTo(null);
    } finally {
      setBusy(false);
    }
  };

  const startReply = (target: ReplyTarget) => {
    setReplyTo(target);
    setText('');
  };

  const cancelReply = () => setReplyTo(null);

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
          {threads.length === 0 ? (
            <div className="cempty">be first to comment — host picks who joins</div>
          ) : (
            threads.map((thread) => (
              <div key={thread.id} className="cthread-group">
                <CommentRow
                  c={thread}
                  post={post}
                  isHost={isHost}
                  filled={filled}
                  capacity={capacity}
                  canReply={canReply}
                  onReply={startReply}
                  addParticipant={addParticipant}
                  removeParticipant={removeParticipant}
                />
                {thread.replies.length > 0 && (
                  <div className="creplies">
                    {thread.replies.map((reply) => (
                      <CommentRow
                        key={reply.id}
                        c={reply}
                        post={post}
                        isHost={isHost}
                        filled={filled}
                        capacity={capacity}
                        canReply={canReply}
                        onReply={startReply}
                        addParticipant={addParticipant}
                        removeParticipant={removeParticipant}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))
          )}

          {canCompose && (
            <div className="ccompose">
              {replyTo && (
                <div className="creply-banner">
                  <span>
                    replying to <strong>{replyTo.name.toUpperCase()}</strong>
                  </span>
                  <button type="button" className="creply-cancel" onClick={cancelReply}>
                    cancel
                  </button>
                </div>
              )}
              <div className="ccompose-row">
                <input
                  className="cinp"
                  placeholder={
                    replyTo
                      ? 'write a reply...'
                      : isHost
                        ? 'comment on your post...'
                        : "say you're down to meet..."
                  }
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && void send()}
                />
                <button type="button" className="csend" onClick={() => void send()} disabled={busy}>
                  {replyTo ? 'reply' : 'post'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
