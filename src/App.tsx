import { AppProvider, useApp } from './context/AppContext';
import { BottomNav } from './components/BottomNav';
import { PostSheet } from './components/PostSheet';
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
  const { screen } = useApp();

  return (
    <div id="app">
      {SCREEN_ORDER.map((name) => (
        <div
          key={name}
          className={`screen${screen === name ? ' active' : ''}`}
          id={`screen-${name}`}
        >
          {SCREEN_CONTENT[name]}
        </div>
      ))}
      <PostSheet />
      <RateOverlay />
      <BottomNav />
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
