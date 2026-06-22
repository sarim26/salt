import { AVC } from '../constants';
import { Logo } from '../components/Logo';
import { useApp } from '../context/AppContext';

export function ChatsScreen() {
  const {
    chats,
    incomingMeetRequests,
    confirmMeet,
    declineMeet,
    openChatWithPeer,
    openChatD,
  } = useApp();

  return (
    <>
      <div className="hdr">
        <Logo />
        <div className="hdr-right">
          <span
            style={{
              fontFamily: 'var(--fh)',
              fontSize: 13,
              fontWeight: 700,
              color: 'var(--muted)',
              textTransform: 'uppercase',
              letterSpacing: 1,
            }}
          >
            chats
          </span>
        </div>
      </div>
      <div className="scroll">
        {incomingMeetRequests.length > 0 && (
          <div className="meet-req-wrap">
            <div className="meet-req-hdr">
              <i className="ti ti-hand-stop" style={{ marginRight: 6 }} />
              meet requests
            </div>
            {incomingMeetRequests.map((r) => (
              <div key={r.id} className="meet-req-card">
                <div className="meet-req-top">
                  <div className="meet-req-avi" style={{ background: AVC[0] }}>
                    {r.requesterInitials}
                  </div>
                  <div>
                    <div className="meet-req-name">{r.requesterName.toUpperCase()}</div>
                    <div className="meet-req-prev">&ldquo;{r.postPreview}&rdquo; · {r.time}</div>
                  </div>
                </div>
                <div className="meet-req-acts">
                  <button
                    type="button"
                    className="meet-req-btn"
                    onClick={() => confirmMeet(r.id)}
                  >
                    confirm we met
                  </button>
                  <button
                    type="button"
                    className="meet-req-btn ghost"
                    onClick={() => declineMeet(r.id)}
                  >
                    not yet
                  </button>
                  <button
                    type="button"
                    className="meet-req-btn ghost"
                    onClick={() => openChatWithPeer(r.requesterUid, r.postId)}
                  >
                    chat
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="clw">
          {chats.length ? (
            chats.map((c) => (
              <div
                key={c.id}
                className={`ci${c.unread ? ' unread' : ''}`}
                onClick={() => openChatD(c.id)}
                role="button"
                tabIndex={0}
              >
                <div className="ciavi" style={{ background: AVC[c.av] }}>
                  {c.i}
                  {c.unread && <span className="undot" />}
                </div>
                <div className="ciinfo">
                  <div className="ciname">{c.n.toUpperCase()}</div>
                  <div className="ciprev">{c.preview || 'tap to chat'}</div>
                </div>
                <div className="citime">{c.time}</div>
              </div>
            ))
          ) : (
            <div className="empty">
              <i className="ti ti-message-off" />
              <div className="etit">no chats yet</div>
              meet someone first.
            </div>
          )}
        </div>
      </div>
    </>
  );
}
