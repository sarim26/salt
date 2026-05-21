import { useApp } from '../context/AppContext';
import type { Screen } from '../types';

const NAV_ITEMS: { id: Screen; icon: string; label: string }[] = [
  { id: 'feed', icon: 'ti-home', label: 'feed' },
  { id: 'explore', icon: 'ti-search', label: 'find' },
  { id: 'chats', icon: 'ti-message-circle', label: 'chats' },
  { id: 'profile', icon: 'ti-user', label: 'me' },
];

export function BottomNav() {
  const { screen, goScreen, openSheet, user } = useApp();

  if (!user) return null;

  return (
    <div className="bnav" id="bnav">
      {NAV_ITEMS.slice(0, 2).map((item) => (
        <button
          key={item.id}
          type="button"
          className={`ni${screen === item.id ? ' on' : ''}`}
          id={`nav-${item.id}`}
          onClick={() => goScreen(item.id)}
        >
          <i className={`ti ${item.icon}`} />
          {item.label}
        </button>
      ))}
      <button type="button" className="npost" onClick={openSheet}>
        <i className="ti ti-plus" />
      </button>
      {NAV_ITEMS.slice(2).map((item) => (
        <button
          key={item.id}
          type="button"
          className={`ni${screen === item.id ? ' on' : ''}`}
          id={`nav-${item.id}`}
          onClick={() => goScreen(item.id)}
        >
          <i className={`ti ${item.icon}`} />
          {item.label}
        </button>
      ))}
    </div>
  );
}
