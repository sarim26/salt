import { useEffect, useRef, useState } from 'react';
import { AVC } from '../constants';
import { useApp } from '../context/AppContext';
import { lvl } from '../utils/helpers';

export function ChatDetailScreen() {
  const { user, chats, curChat, currentChatMessages, goScreen, sendMsg } = useApp();
  const [input, setInput] = useState('');
  const msgsRef = useRef<HTMLDivElement>(null);

  const c = chats.find((x) => x.id === curChat);
  const msgs = currentChatMessages;

  useEffect(() => {
    if (msgsRef.current) msgsRef.current.scrollTop = msgsRef.current.scrollHeight;
  }, [msgs]);

  if (!user || !c) return null;

  return (
    <div className="csi">
      <div className="chdr">
        <button type="button" className="cbk" onClick={() => goScreen('chats')}>
          <i className="ti ti-arrow-left" />
        </button>
        <div className="chinfo">
          <div className="chname">{c.n.toUpperCase()}</div>
          <div className="chsub">
            {user.name} · {lvl(c.aura).toLowerCase()} · ✦ {c.aura} aura
          </div>
        </div>
        <div
          style={{
            width: 34,
            height: 34,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'var(--fh)',
            fontSize: 13,
            fontWeight: 900,
            color: 'white',
            background: AVC[c.av],
          }}
        >
          {c.i}
        </div>
      </div>
      <div className="msgs" ref={msgsRef}>
        {msgs.map((m, i) => (
          <div key={i} className={`msg ${m.me ? 'me' : 'them'}`}>
            <div className="mbub">{m.text}</div>
            <div className="mtime">{m.time}</div>
          </div>
        ))}
      </div>
      <div className="cinrow">
        <input
          className="cinp"
          placeholder="type a message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              sendMsg(input);
              setInput('');
            }
          }}
        />
        <button
          type="button"
          className="csend"
          onClick={() => {
            sendMsg(input);
            setInput('');
          }}
        >
          <i className="ti ti-send" />
        </button>
      </div>
    </div>
  );
}
