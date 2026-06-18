import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { UNIVERSITIES } from '../data/universities';
import { useAuthState } from '../hooks/useAuthState';
import { isFirebaseConfigured } from '../lib/firebase';
import {
  logOut as firebaseLogOut,
  resendVerification,
  resetPassword,
  signIn,
  signUp,
  refreshAuthUser,
  deleteAccount as firebaseDeleteAccount,
} from '../services/auth';
import {
  markChatRead,
  openChatFromPostAuthor,
  sendMessage,
  subscribeAuraEvents,
  subscribeChats,
  subscribeMessages,
} from '../services/chats';
import {
  createPost,
  setVote,
  subscribeFeed,
  subscribeLeaderboard,
  subscribeMyPosts,
  subscribeProfile,
} from '../services/posts';
import { applyPendingRatings, submitRating, subscribePendingRatings } from '../services/ratings';
import { uploadAvatar } from '../services/users';
import { sharePost as sharePostUtil } from '../utils/share';
import type { UserProfile } from '../types/firestore';
import type {
  AppMode,
  AuraHistoryItem,
  Chat,
  ChatMessage,
  FilterTab,
  LeaderboardUser,
  Post,
  Screen,
  User,
} from '../types';
import { firestoreErrorMessage } from '../utils/firestoreErrors';
import {
  auraGiven,
  decayNote,
  lvl,
  sortedPosts,
  tagAff,
} from '../utils/helpers';

interface AppContextValue {
  screen: Screen;
  appMode: AppMode;
  authLoading: boolean;
  authMode: 'signin' | 'signup';
  pendingVerification: boolean;
  needsEmailVerification: boolean;
  user: User | null;
  profile: UserProfile | null;
  firebaseUid: string | null;
  myAura: number;
  filter: FilterTab;
  posts: Post[];
  myPostHistory: Post[];
  chats: Chat[];
  currentChatMessages: ChatMessage[];
  lb: LeaderboardUser[];
  myPosts: number;
  myMeets: number;
  aHist: AuraHistoryItem[];
  earnedBdg: Set<string>;
  curChat: string | number | null;
  toastMsg: string;
  toastVisible: boolean;
  sheetOpen: boolean;
  rateOpen: boolean;
  ratePostId: string | number | null;
  rateWho: string;
  rateDecay: string;
  ratePointsLabel: string;
  starV: number;
  loginError: string;
  postText: string;
  postTag: string;
  postLoc: string;
  loginEmail: string;
  loginPassword: string;
  searchQuery: string;
  setAuthMode: (m: 'signin' | 'signup') => void;
  setLoginEmail: (v: string) => void;
  setLoginPassword: (v: string) => void;
  setPostText: (v: string) => void;
  setPostTag: (v: string) => void;
  setPostLoc: (v: string) => void;
  setStarV: (n: number) => void;
  goScreen: (n: Screen) => void;
  doLogin: () => void;
  doLogout: () => void;
  deleteAccount: (password: string) => Promise<void>;
  uploadProfilePhoto: (file: File) => Promise<void>;
  resendVerification: () => void;
  checkVerification: () => void;
  resetPassword: () => void;
  showAura: () => void;
  setFilterTab: (f: FilterTab) => void;
  doTabAndGo: (f: FilterTab) => void;
  vote: (id: string | number, d: number) => void;
  meetUp: (id: string | number) => void;
  openChatFromPost: (id: string | number) => void;
  sharePost: (id: string | number) => void;
  openChatD: (id: string | number) => void;
  sendMsg: (text: string) => void;
  openSheet: () => void;
  openSheetWith: (t: string) => void;
  closeSheet: (targetId?: string) => void;
  doPost: () => void;
  submitRate: () => void;
  closeRate: () => void;
  getSortedPosts: () => Post[];
  getTagAff: () => Record<string, number>;
  doSearch: (v: string) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

const INITIAL_BADGES = new Set(['verified student', 'early adopter']);

function profileToUser(profile: UserProfile): User {
  const uni = UNIVERSITIES[profile.schoolDomain];
  return {
    domain: profile.schoolDomain,
    name: uni?.name ?? profile.schoolDomain,
    city: uni?.city ?? '',
    ini: profile.initials,
    full: profile.displayName,
    school: profile.schoolLabel,
    photoUrl: profile.photoUrl ?? null,
    posts: [],
    chats: [],
    lb: [],
  };
}

export function AppProvider({ children }: { children: ReactNode }) {
  const { firebaseUser, loading: authLoading, setFirebaseUser } = useAuthState();

  const [appMode, setAppMode] = useState<AppMode>(null);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [pendingVerification, setPendingVerification] = useState(false);
  const [screen, setScreen] = useState<Screen>('login');
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [myAura, setMyAura] = useState(247);
  const [filter, setFilter] = useState<FilterTab>('all');
  const [posts, setPosts] = useState<Post[]>([]);
  const [myPostHistory, setMyPostHistory] = useState<Post[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChatMessages, setCurrentChatMessages] = useState<ChatMessage[]>([]);
  const [lb, setLb] = useState<LeaderboardUser[]>([]);
  const [myPosts, setMyPosts] = useState(0);
  const [myMeets, setMyMeets] = useState(0);
  const [meetCounts, setMeetCounts] = useState<Record<string, number>>({});
  const [metPostIds, setMetPostIds] = useState<Set<string | number>>(new Set());
  const [aHist, setAHist] = useState<AuraHistoryItem[]>([]);
  const [earnedBdg, setEarnedBdg] = useState<Set<string>>(new Set(INITIAL_BADGES));
  const [curChat, setCurChat] = useState<string | number | null>(null);
  const [ratePostId, setRatePostId] = useState<string | number | null>(null);
  const [rateTargetUid, setRateTargetUid] = useState<string | null>(null);
  const [rateWho, setRateWho] = useState('');
  const [rateDecay, setRateDecay] = useState('');
  const [ratePointsLabel, setRatePointsLabel] = useState('select stars to see aura given');
  const [starV, setStarV] = useState(0);
  const [toastMsg, setToastMsg] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [rateOpen, setRateOpen] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [postText, setPostText] = useState('');
  const [postTag, setPostTag] = useState('food');
  const [postLoc, setPostLoc] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const toast = useCallback((m: string) => {
    setToastMsg(m);
    setToastVisible(true);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastVisible(false), 3400);
  }, []);

  const resetSession = useCallback(() => {
    setAppMode(null);
    setUser(null);
    setProfile(null);
    setPendingVerification(false);
    setPosts([]);
    setMyPostHistory([]);
    setChats([]);
    setCurrentChatMessages([]);
    setLb([]);
    setMyAura(247);
    setMyPosts(0);
    setMyMeets(0);
    setMeetCounts({});
    setMetPostIds(new Set());
    setAHist([]);
    setEarnedBdg(new Set(INITIAL_BADGES));
    setCurChat(null);
    setFilter('all');
    setScreen('login');
  }, []);

  const applyProfile = useCallback(
    (p: UserProfile) => {
      if (!firebaseUser?.emailVerified) return;
      setProfile(p);
      setUser(profileToUser(p));
      setMyAura(p.aura);
      setMyPosts(p.postCount);
      setMyMeets(p.meetCount);
      setMeetCounts(p.meetCounts || {});
      setEarnedBdg(new Set(p.badges || []));
    },
    [firebaseUser?.emailVerified]
  );

  const blockUnverifiedSession = useCallback(() => {
    setPendingVerification(true);
    setAppMode(null);
    setUser(null);
    setProfile(null);
    setPosts([]);
    setMyPostHistory([]);
    setChats([]);
    setCurrentChatMessages([]);
    setLb([]);
    setScreen('login');
  }, []);

  const doLogin = useCallback(async () => {
    if (!isFirebaseConfigured) {
      setLoginError('app not configured — firebase keys missing');
      return;
    }

    setLoginError('');
    try {
      const fbUser =
        authMode === 'signup'
          ? await signUp(loginEmail, loginPassword)
          : await signIn(loginEmail, loginPassword);

      if (!fbUser.emailVerified) {
        blockUnverifiedSession();
        setLoginEmail(fbUser.email || loginEmail);
        return;
      }

      setPendingVerification(false);
    } catch (e) {
      setLoginError(e instanceof Error ? e.message : 'authentication failed');
    }
  }, [loginEmail, loginPassword, authMode, blockUnverifiedSession]);

  const handleResendVerification = useCallback(async () => {
    if (!firebaseUser) return;
    setLoginError('');
    try {
      await resendVerification(firebaseUser);
      toast('VERIFICATION EMAIL SENT');
    } catch (e) {
      setLoginError(e instanceof Error ? e.message : 'could not resend email');
    }
  }, [firebaseUser, toast]);

  const checkVerification = useCallback(async () => {
    if (!firebaseUser) return;
    setLoginError('');
    try {
      const fresh = await refreshAuthUser(firebaseUser);
      setFirebaseUser(fresh);
      if (!fresh.emailVerified) {
        setLoginError('email not verified yet — check your inbox');
        blockUnverifiedSession();
        return;
      }
      setPendingVerification(false);
    } catch (e) {
      setLoginError(e instanceof Error ? e.message : 'could not verify status');
    }
  }, [firebaseUser, setFirebaseUser, blockUnverifiedSession]);

  const handleResetPassword = useCallback(async () => {
    setLoginError('');
    try {
      await resetPassword(loginEmail);
      toast('PASSWORD RESET EMAIL SENT');
    } catch (e) {
      setLoginError(e instanceof Error ? e.message : 'could not send reset email');
    }
  }, [loginEmail, toast]);

  const doLogout = useCallback(async () => {
    if (isFirebaseConfigured) {
      try {
        await firebaseLogOut();
      } catch {
        /* ignore */
      }
    }
    resetSession();
    setLoginEmail('');
    setLoginPassword('');
    setLoginError('');
  }, [resetSession]);

  const deleteAccount = useCallback(
    async (password: string) => {
      if (!isFirebaseConfigured) throw new Error('Firebase not configured');
      await firebaseDeleteAccount(password);
      resetSession();
      setLoginEmail('');
      setLoginPassword('');
      setLoginError('');
    },
    [resetSession]
  );

  useEffect(() => {
    if (authLoading) return;
    if (!firebaseUser) {
      if (profile || appMode === 'live') resetSession();
      return;
    }
    if (!firebaseUser.emailVerified) {
      blockUnverifiedSession();
      setLoginEmail(firebaseUser.email || '');
    } else {
      setPendingVerification(false);
    }
  }, [firebaseUser, authLoading, profile, appMode, resetSession, blockUnverifiedSession]);

  useEffect(() => {
    if (!firebaseUser?.emailVerified) return;
    if (profile) setAppMode('live');
  }, [firebaseUser, profile]);

  useEffect(() => {
    if (!firebaseUser?.emailVerified) return;

    const uid = firebaseUser.uid;
    return subscribeProfile(
      uid,
      firebaseUser.email,
      (p) => {
        if (p && firebaseUser.emailVerified) {
          applyProfile(p);
          setAppMode('live');
          setScreen((s) => (s === 'login' ? 'feed' : s));
        }
      },
      (err) => toast(firestoreErrorMessage(err))
    );
  }, [firebaseUser, applyProfile, toast]);

  useEffect(() => {
    if (!profile || !firebaseUser?.uid) return;
    applyPendingRatings(firebaseUser.uid).catch((e) => {
      toast(firestoreErrorMessage(e));
    });
  }, [profile, firebaseUser?.uid, toast]);

  useEffect(() => {
    if (!firebaseUser?.emailVerified || !profile) return;

    const uid = firebaseUser.uid;
    const domain = profile.schoolDomain;
    const onErr = (err: Error) => toast(firestoreErrorMessage(err));

    const unsubs = [
      subscribeFeed(
        domain,
        uid,
        (feedPosts) => {
          setPosts(
            feedPosts.map((p) => ({
              ...p,
              met: metPostIds.has(p.id),
            }))
          );
        },
        onErr
      ),
      subscribeLeaderboard(domain, setLb),
      subscribeChats(uid, domain, setChats, onErr),
      subscribeAuraEvents(uid, setAHist, onErr),
      subscribePendingRatings(
        uid,
        (count) => {
          if (count > 0) toast(`+${count} NEW RATING${count > 1 ? 'S' : ''} APPLIED TO YOUR AURA`);
        },
        onErr
      ),
      subscribeMyPosts(uid, setMyPostHistory, onErr),
    ];

    return () => unsubs.forEach((u) => u());
  }, [firebaseUser, profile, metPostIds, toast]);

  useEffect(() => {
    if (!firebaseUser || !curChat) {
      setCurrentChatMessages([]);
      return;
    }
    return subscribeMessages(
      String(curChat),
      firebaseUser.uid,
      setCurrentChatMessages,
      (err) => toast(firestoreErrorMessage(err))
    );
  }, [firebaseUser, curChat, toast]);

  useEffect(() => {
    if (!firebaseUser || !curChat) return;
    markChatRead(String(curChat), firebaseUser.uid);
  }, [firebaseUser, curChat, currentChatMessages.length]);

  const goScreen = useCallback(
    (n: Screen) => {
      const hasSession = user || pendingVerification;
      if (!hasSession && n !== 'login') return;
      setScreen(n);
      if (n === 'explore') setSearchQuery('');
    },
    [user, pendingVerification]
  );

  const showAura = useCallback(() => {
    toast(`YOUR AURA: ${myAura} · ${lvl(myAura)}`);
  }, [myAura, toast]);

  const setFilterTab = useCallback((f: FilterTab) => setFilter(f), []);

  const doTabAndGo = useCallback(
    (f: FilterTab) => {
      setFilter(f);
      goScreen('feed');
    },
    [goScreen]
  );

  const getSortedPosts = useCallback(() => {
    if (!user) return [];
    return sortedPosts(posts, filter, user.ini);
  }, [posts, filter, user]);

  const getTagAff = useCallback(() => {
    if (!user) return { food: 0, trade: 0, hang: 0 };
    return tagAff(posts, user.ini);
  }, [posts, user]);

  const vote = useCallback(
    async (id: string | number, d: number) => {
      if (!firebaseUser) return;
      try {
        await setVote(String(id), firebaseUser.uid, d as 1 | -1);
      } catch (e) {
        toast(e instanceof Error ? e.message : 'vote failed');
      }
    },
    [firebaseUser, toast]
  );

  const meetUp = useCallback(
    (id: string | number) => {
      const p = posts.find((x) => x.id === id);
      if (!p) return;

      if (firebaseUser && p.authorUid && p.authorUid === firebaseUser.uid) {
        toast('YOU CANNOT RATE YOUR OWN POST');
        return;
      }

      setMetPostIds((prev) => new Set(prev).add(id));
      setPosts((prev) => prev.map((x) => (x.id === id ? { ...x, met: true } : x)));

      const targetKey = p.authorUid || p.i;
      setTimeout(() => {
        setRatePostId(id);
        setRateTargetUid(p.authorUid || null);
        setStarV(0);
        setRateWho(p.n.toUpperCase());
        setRateDecay(decayNote(targetKey, meetCounts));
        setRatePointsLabel('select stars to see aura given');
        setRateOpen(true);
      }, 400);
    },
    [posts, meetCounts, firebaseUser, toast]
  );

  const sharePost = useCallback(
    async (id: string | number) => {
      const p = posts.find((x) => x.id === id);
      if (!p || !user) return;
      try {
        const result = await sharePostUtil(p, user.name);
        toast(result === 'shared' ? 'POST SHARED' : 'POST LINK COPIED');
      } catch (e) {
        if ((e as Error).name !== 'AbortError') {
          toast(e instanceof Error ? e.message : 'share failed');
        }
      }
    },
    [posts, user, toast]
  );

  const openChatFromPost = useCallback(
    async (id: string | number) => {
      const p = posts.find((x) => x.id === id);
      if (!p) return;

      if (!firebaseUser || !profile || !p.authorUid) return;
      if (p.authorUid === firebaseUser.uid) {
        toast('YOU CANNOT REPLY TO YOUR OWN POST');
        return;
      }
      try {
        const chatId = await openChatFromPostAuthor(
          firebaseUser.uid,
          profile,
          p.authorUid,
          String(p.id)
        );
        setCurChat(chatId);
        setScreen('chat-detail');
      } catch (e) {
        toast(e instanceof Error ? e.message : 'could not open chat');
      }
    },
    [posts, firebaseUser, profile, toast]
  );

  const openChatD = useCallback((id: string | number) => {
    setCurChat(id);
    setScreen('chat-detail');
  }, []);

  const sendMsg = useCallback(
    async (text: string) => {
      const txt = text.trim();
      if (!txt || curChat == null) return;

      if (!firebaseUser) return;
      const chat = chats.find((c) => c.id === curChat);
      if (!chat?.peerUid) return;
      try {
        await sendMessage(
          String(curChat),
          firebaseUser.uid,
          chat.peerUid,
          txt,
          chat.sourcePostId
        );
      } catch (e) {
        toast(e instanceof Error ? e.message : 'send failed');
      }
    },
    [curChat, firebaseUser, chats, toast]
  );

  const openSheet = useCallback(() => setSheetOpen(true), []);
  const openSheetWith = useCallback((t: string) => {
    setPostTag(t);
    setSheetOpen(true);
  }, []);
  const closeSheet = useCallback((targetId?: string) => {
    if (targetId === 'sheet' || targetId === undefined) setSheetOpen(false);
  }, []);

  const doPost = useCallback(async () => {
    const txt = postText.trim();
    if (!txt || !user) return;
    const loc = postLoc.trim();

    if (!firebaseUser || !profile) return;
    try {
      await createPost(firebaseUser.uid, profile, txt, [postTag], loc || null);
      setPostText('');
      setPostLoc('');
      setSheetOpen(false);
      setFilter('all');
      toast('POST IS LIVE — GONE IN 24H');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'post failed');
    }
  }, [postText, postTag, postLoc, user, toast, firebaseUser, profile]);

  const setStarWithFeedback = useCallback(
    (n: number) => {
      setStarV(n);
      const targetKey =
        rateTargetUid || posts.find((x) => x.id === ratePostId)?.i;
      if (targetKey) {
        setRatePointsLabel(`GIVES THEM ${auraGiven(n, targetKey, meetCounts)} AURA PTS`);
      }
    },
    [posts, ratePostId, rateTargetUid, meetCounts]
  );

  const submitRate = useCallback(async () => {
    let stars = starV;
    if (!stars) stars = 3;
    const p = posts.find((x) => x.id === ratePostId);
    if (!p) return;

    if (!ratePostId || !firebaseUser || !profile) return;
    if (p.authorUid && p.authorUid === firebaseUser.uid) {
      toast('YOU CANNOT RATE YOUR OWN POST');
      setRateOpen(false);
      return;
    }
    try {
      const result = await submitRating(
        firebaseUser.uid,
        profile,
        String(ratePostId),
        p,
        stars
      );
      setRateOpen(false);
      toast(
        `+${result.auraGiven} AURA SENT · +${result.reviewerReward} TO YOU · THEY GET IT WHEN ONLINE`
      );
    } catch (e) {
      toast(e instanceof Error ? e.message : 'rating failed');
    }
  }, [starV, posts, ratePostId, toast, firebaseUser, profile]);

  const closeRate = useCallback(() => setRateOpen(false), []);

  const doSearch = useCallback((v: string) => setSearchQuery(v), []);

  const uploadProfilePhoto = useCallback(
    async (file: File) => {
      if (!firebaseUser) return;
      try {
        const photoUrl = await uploadAvatar(firebaseUser.uid, file);
        setProfile((prev) => (prev ? { ...prev, photoUrl } : prev));
        setUser((prev) => (prev ? { ...prev, photoUrl } : prev));
        toast('PROFILE PHOTO UPDATED');
      } catch (e) {
        toast(e instanceof Error ? e.message : 'upload failed');
      }
    },
    [firebaseUser, toast]
  );

  const needsEmailVerification = Boolean(firebaseUser && !firebaseUser.emailVerified);

  const value: AppContextValue = {
    screen,
    appMode,
    authLoading,
    authMode,
    pendingVerification,
    needsEmailVerification,
    user,
    profile,
    firebaseUid: firebaseUser?.uid ?? null,
    myAura,
    filter,
    posts,
    myPostHistory,
    chats,
    currentChatMessages,
    lb,
    myPosts,
    myMeets,
    aHist,
    earnedBdg,
    curChat,
    toastMsg,
    toastVisible,
    sheetOpen,
    rateOpen,
    ratePostId,
    rateWho,
    rateDecay,
    ratePointsLabel,
    starV,
    loginError,
    postText,
    postTag,
    postLoc,
    loginEmail,
    loginPassword,
    searchQuery,
    setAuthMode,
    setLoginEmail,
    setLoginPassword,
    setPostText,
    setPostTag,
    setPostLoc,
    setStarV: setStarWithFeedback,
    goScreen,
    doLogin,
    doLogout,
    deleteAccount,
    uploadProfilePhoto,
    resendVerification: handleResendVerification,
    checkVerification,
    resetPassword: handleResetPassword,
    showAura,
    setFilterTab,
    doTabAndGo,
    vote,
    meetUp,
    openChatFromPost,
    sharePost,
    openChatD,
    sendMsg,
    openSheet,
    openSheetWith,
    closeSheet,
    doPost,
    submitRate,
    closeRate,
    getSortedPosts,
    getTagAff,
    doSearch,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
