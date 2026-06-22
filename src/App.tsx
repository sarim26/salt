import { AppProvider, useApp } from './context/AppContext';
import { BottomNav } from './components/BottomNav';
import { PostSheet } from './components/PostSheet';
import { MeetConfirmOverlay } from './components/MeetConfirmOverlay';
import { GlobalToast } from './components/GlobalToast';
import { RateOverlay } from './components/RateOverlay';
import { LoginScreen } from './screens/LoginScreen';
import { FeedScreen } from './screens/FeedScreen';
import { ExploreScreen } from './screens/ExploreScreen';
import { ChatsScreen } from './screens/ChatsScreen';
import { ChatDetailScreen } from './screens/ChatDetailScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import type { Screen } from './types';

const SCREEN_ORDER: Screen[] = [
  'login',
  'feed',
  'explore',
  'chats',
  'chat-detail',
  'profile',
];

const SCREEN_CONTENT: Record<Screen, React.ReactNode> = {
  login: <LoginScreen />,
  feed: <FeedScreen />,
  explore: <ExploreScreen />,
  chats: <ChatsScreen />,
  'chat-detail': <ChatDetailScreen />,
  profile: <ProfileScreen />,
};

function AppShell() {
  const { screen, authLoading, user, firebaseUid, bootstrapError, doLogout } = useApp();

  const bootstrapping = authLoading || (Boolean(firebaseUid) && !user);

  if (bootstrapping) {
    return (
      <div id="app">
        <div className="screen active" id="screen-login" style={{ justifyContent: 'center' }}>
          <div className="login-tag">loading...</div>
          {bootstrapError && (
            <p
              style={{
                fontSize: 11,
                color: 'var(--red)',
                maxWidth: 280,
                textAlign: 'center',
                marginTop: 12,
                lineHeight: 1.5,
                fontFamily: 'var(--fm)',
              }}
            >
              {bootstrapError}
            </p>
          )}
          {firebaseUid && (
            <button
              type="button"
              className="rskip"
              style={{ marginTop: 16 }}
              onClick={doLogout}
            >
              sign out
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div id="app">
      {SCREEN_ORDER.map((name) => (
        <div
          key={name}
          className={`screen${screen === name ? ' active' : ''}`}
          id={`screen-${name}`}
        >
          {name === 'login' || user ? SCREEN_CONTENT[name] : null}
        </div>
      ))}
      {user && (
        <>
          <GlobalToast />
          <PostSheet />
          <MeetConfirmOverlay />
          <RateOverlay />
          <BottomNav />
        </>
      )}
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  );
}
