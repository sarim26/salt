import { AVC } from '../constants';
import { useApp } from '../context/AppContext';

export function ChatsScreen() {
  const { chats, openChatD } = useApp();

  return (
    <>
      <div className="hdr">
        <div className="logo">SALT 🧂</div>
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
