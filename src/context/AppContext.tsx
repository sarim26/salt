import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { DEMO_DOMAINS, REVIEWER_RWD } from '../constants';
import { UNIVERSITIES } from '../data/universities';
import { useAuthState } from '../hooks/useAuthState';
import { isFirebaseConfigured } from '../lib/firebase';
import {
  logOut as firebaseLogOut,
  resendVerification,
  resetPassword,
  signIn,
  signUp,
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
  subscribeProfile,
} from '../services/posts';
import { applyPendingRatings, submitRating } from '../services/ratings';
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
import {
  auraGiven,
  decayNote,
  lvl,
  now,
  sortedPosts,
  tagAff,
} from '../utils/helpers';

interface AppContextValue {
  screen: Screen;
  appMode: AppMode;
  authLoading: boolean;
  authMode: 'signin' | 'signup';
  pendingVerification: boolean;
  user: User | null;
  profile: UserProfile | null;
  firebaseUid: string | null;
  myAura: number;
  filter: FilterTab;
  posts: Post[];
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
  demoLogin: (u: string) => void;
  doLogout: () => void;
  resendVerification: () => void;
  checkVerification: () => void;
  resetPassword: () => void;
  showAura: () => void;
  setFilterTab: (f: FilterTab) => void;
  doTabAndGo: (f: FilterTab) => void;
  vote: (id: string | number, d: number) => void;
  meetUp: (id: string | number) => void;
  openChatFromPost: (id: string | number) => void;
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
    posts: [],
    chats: [],
    lb: [],
  };
}

export function AppProvider({ children }: { children: ReactNode }) {
  const { firebaseUser, loading: authLoading } = useAuthState();

  const [appMode, setAppMode] = useState<AppMode>(null);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [pendingVerification, setPendingVerification] = useState(false);
  const [screen, setScreen] = useState<Screen>('login');
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [myAura, setMyAura] = useState(247);
  const [filter, setFilter] = useState<FilterTab>('all');
  const [posts, setPosts] = useState<Post[]>([]);
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
  const [nid, setNid] = useState(999);
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

  const unlockBdg = useCallback(
    (name: string) => {
      setEarnedBdg((prev) => {
        if (prev.has(name)) return prev;
        const next = new Set(prev);
        next.add(name);
        setAHist((h) =>
          h.concat({
            ico: 'ti-award',
            txt: `badge unlocked: ${name}`,
            pts: '🏅',
            t: 'just now',
          })
        );
        toast(`BADGE UNLOCKED: ${name.toUpperCase()}`);
        return next;
      });
    },
    [toast]
  );

  const resetSession = useCallback(() => {
    setAppMode(null);
    setUser(null);
    setProfile(null);
    setPendingVerification(false);
    setPosts([]);
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

  const loginAsDemo = useCallback((dom: string) => {
    const data = UNIVERSITIES[dom];
    if (!data) return;
    setAppMode('demo');
    setUser({ domain: dom, ...data });
    setProfile(null);
    setMyAura(247);
    setMyPosts(0);
    setMyMeets(0);
    setMeetCounts({});
    setMetPostIds(new Set());
    setAHist([]);
    setFilter('all');
    setPosts(
      JSON.parse(JSON.stringify(data.posts)).map((p: Post) => ({
        ...p,
        id: String(p.id),
      }))
    );
    setChats(
      JSON.parse(JSON.stringify(data.chats)).map((c: Chat) => ({
        ...c,
        id: String(c.id),
      }))
    );
    setLb(JSON.parse(JSON.stringify(data.lb)) as LeaderboardUser[]);
    setEarnedBdg(new Set(INITIAL_BADGES));
    setPendingVerification(false);
    setScreen('feed');
  }, []);

  const applyProfile = useCallback((p: UserProfile) => {
    setProfile(p);
    setUser(profileToUser(p));
    setMyAura(p.aura);
    setMyPosts(p.postCount);
    setMyMeets(p.meetCount);
    setMeetCounts(p.meetCounts || {});
    setEarnedBdg(new Set(p.badges || []));
  }, []);

  const demoLogin = useCallback(
    (u: string) => {
      const dom = DEMO_DOMAINS[u];
      if (dom) loginAsDemo(dom);
    },
    [loginAsDemo]
  );

  const doLogin = useCallback(async () => {
    if (!isFirebaseConfigured) {
      const em = loginEmail.trim().toLowerCase();
      if (!em.includes('@')) {
        setLoginError('enter a valid .edu email');
        return;
      }
      const dom = em.split('@')[1];
      if (!UNIVERSITIES[dom]) {
        setLoginError('only uic.edu, illinois.edu, mit.edu in demo');
        return;
      }
      if (loginPassword.length < 3) {
        setLoginError('password too short');
        return;
      }
      setLoginError('');
      loginAsDemo(dom);
      return;
    }

    setLoginError('');
    try {
      const fbUser =
        authMode === 'signup'
          ? await signUp(loginEmail, loginPassword)
          : await signIn(loginEmail, loginPassword);

      if (!fbUser.emailVerified) {
        setPendingVerification(true);
        setAppMode(null);
        setScreen('login');
        return;
      }
    } catch (e) {
      setLoginError(e instanceof Error ? e.message : 'authentication failed');
    }
  }, [loginEmail, loginPassword, authMode, loginAsDemo]);

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
      await firebaseUser.reload();
      if (!firebaseUser.emailVerified) {
        setLoginError('email not verified yet — check your inbox');
        return;
      }
      setPendingVerification(false);
    } catch (e) {
      setLoginError(e instanceof Error ? e.message : 'could not verify status');
    }
  }, [firebaseUser]);

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
    if (appMode === 'live' && isFirebaseConfigured) {
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
  }, [appMode, resetSession]);

  useEffect(() => {
    if (authLoading || appMode === 'demo') return;
    if (!firebaseUser) {
      if (appMode === 'live') resetSession();
      return;
    }
    if (!firebaseUser.emailVerified) {
      setPendingVerification(true);
      setLoginEmail(firebaseUser.email || '');
      setScreen('login');
    }
  }, [firebaseUser, authLoading, appMode, resetSession]);

  useEffect(() => {
    if (!firebaseUser?.emailVerified || appMode === 'demo') return;
    if (profile) setAppMode('live');
  }, [firebaseUser, profile, appMode]);

  useEffect(() => {
    if (appMode === 'demo' || !firebaseUser?.emailVerified) return;

    const uid = firebaseUser.uid;
    return subscribeProfile(
      uid,
      firebaseUser.email,
      (p) => {
        if (p) {
          applyProfile(p);
          setAppMode('live');
          setPendingVerification(false);
          setScreen((s) => (s === 'login' ? 'feed' : s));
        }
      },
      (err) => toast(err.message)
    );
  }, [firebaseUser, applyProfile, toast]);

  useEffect(() => {
    if (appMode !== 'live' || !firebaseUser?.uid) return;
    applyPendingRatings(firebaseUser.uid).catch(() => {});
  }, [appMode, firebaseUser?.uid]);

  useEffect(() => {
    if (appMode === 'demo' || !firebaseUser?.emailVerified || !profile) return;

    const uid = firebaseUser.uid;
    const domain = profile.schoolDomain;

    const unsubs = [
      subscribeFeed(domain, uid, (feedPosts) => {
        setPosts(
          feedPosts.map((p) => ({
            ...p,
            met: metPostIds.has(p.id),
          }))
        );
      }),
      subscribeLeaderboard(domain, setLb),
      subscribeChats(uid, domain, setChats),
      subscribeAuraEvents(uid, setAHist),
    ];

    return () => unsubs.forEach((u) => u());
  }, [appMode, firebaseUser, profile, metPostIds]);

  useEffect(() => {
    if (appMode === 'demo' || !firebaseUser || !curChat) {
      setCurrentChatMessages([]);
      return;
    }
    return subscribeMessages(String(curChat), firebaseUser.uid, setCurrentChatMessages);
  }, [appMode, firebaseUser, curChat]);

  useEffect(() => {
    if (appMode === 'demo' || !firebaseUser || !curChat) return;
    markChatRead(String(curChat), firebaseUser.uid);
  }, [appMode, firebaseUser, curChat, currentChatMessages.length]);

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
      if (appMode === 'live' && firebaseUser) {
        try {
          await setVote(String(id), firebaseUser.uid, d as 1 | -1);
        } catch (e) {
          toast(e instanceof Error ? e.message : 'vote failed');
        }
        return;
      }
      setPosts((prev) =>
        prev.map((p) => {
          if (p.id !== id) return p;
          if (p.uv === d) return { ...p, score: p.score - d, uv: 0 };
          return { ...p, score: p.score + (d - p.uv), uv: d };
        })
      );
    },
    [appMode, firebaseUser, toast]
  );

  const meetUp = useCallback(
    (id: string | number) => {
      const p = posts.find((x) => x.id === id);
      if (!p) return;

      setMetPostIds((prev) => new Set(prev).add(id));
      setPosts((prev) => prev.map((x) => (x.id === id ? { ...x, met: true } : x)));

      if (appMode === 'demo') {
        setMyMeets((m) => m + 1);
      }

      const targetKey = appMode === 'live' ? p.authorUid || p.i : p.i;
      setTimeout(() => {
        setRatePostId(id);
        setRateTargetUid(appMode === 'live' ? p.authorUid || null : null);
        setStarV(0);
        setRateWho(p.n.toUpperCase());
        setRateDecay(decayNote(targetKey, meetCounts));
        setRatePointsLabel('select stars to see aura given');
        setRateOpen(true);
      }, 400);
    },
    [posts, appMode, meetCounts]
  );

  const openChatFromPost = useCallback(
    async (id: string | number) => {
      const p = posts.find((x) => x.id === id);
      if (!p) return;

      if (appMode === 'live' && firebaseUser && profile && p.authorUid) {
        try {
          const chatId = await openChatFromPostAuthor(
            firebaseUser.uid,
            profile,
            p.authorUid
          );
          setCurChat(chatId);
          setScreen('chat-detail');
        } catch (e) {
          toast(e instanceof Error ? e.message : 'could not open chat');
        }
        return;
      }

      setChats((prev) => {
        let c = prev.find((x) => x.n === p.n);
        if (c) {
          setCurChat(c.id);
          setScreen('chat-detail');
          return prev.map((ch) => (ch.id === c!.id ? { ...ch, unread: false } : ch));
        }
        const newChat: Chat = {
          id: String(prev.length + 100),
          n: p.n,
          i: p.i,
          av: p.av,
          aura: p.aura,
          preview: '',
          time: 'now',
          unread: false,
          msgs: [],
        };
        setCurChat(newChat.id);
        setScreen('chat-detail');
        return [newChat, ...prev];
      });
    },
    [posts, appMode, firebaseUser, profile, toast]
  );

  const openChatD = useCallback(
    (id: string | number) => {
      if (appMode === 'demo') {
        setChats((prev) => prev.map((c) => (c.id === id ? { ...c, unread: false } : c)));
      }
      setCurChat(id);
      setScreen('chat-detail');
    },
    [appMode]
  );

  const sendMsg = useCallback(
    async (text: string) => {
      const txt = text.trim();
      if (!txt || curChat == null) return;

      if (appMode === 'live' && firebaseUser) {
        const chat = chats.find((c) => c.id === curChat);
        if (!chat?.peerUid) return;
        try {
          await sendMessage(String(curChat), firebaseUser.uid, chat.peerUid, txt);
        } catch (e) {
          toast(e instanceof Error ? e.message : 'send failed');
        }
        return;
      }

      setChats((prev) =>
        prev.map((c) => {
          if (c.id !== curChat) return c;
          return {
            ...c,
            msgs: [...c.msgs, { me: true, text: txt, time: now() }],
            preview: txt,
            time: 'now',
          };
        })
      );
    },
    [curChat, appMode, firebaseUser, chats, toast]
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

    if (appMode === 'live' && firebaseUser && profile) {
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
      return;
    }

    setMyPosts((n) => {
      const next = n + 1;
      if (next === 1) unlockBdg('first post');
      return next;
    });
    setPosts((prev) => [
      {
        id: String(nid),
        n: user.full,
        i: user.ini,
        av: 0,
        aura: myAura,
        body: txt,
        tags: [postTag],
        loc: loc || null,
        mins: 1440,
        score: 0,
        uv: 0,
        reps: 0,
        met: false,
      },
      ...prev,
    ]);
    setNid((n) => n + 1);
    setPostText('');
    setPostLoc('');
    setSheetOpen(false);
    setFilter('all');
    toast('POST IS LIVE — GONE IN 24H');
  }, [
    postText,
    postTag,
    postLoc,
    user,
    myAura,
    nid,
    unlockBdg,
    toast,
    appMode,
    firebaseUser,
    profile,
  ]);

  const setStarWithFeedback = useCallback(
    (n: number) => {
      setStarV(n);
      const targetKey =
        appMode === 'live' && rateTargetUid ? rateTargetUid : posts.find((x) => x.id === ratePostId)?.i;
      if (targetKey) {
        setRatePointsLabel(`GIVES THEM ${auraGiven(n, targetKey, meetCounts)} AURA PTS`);
      }
    },
    [posts, ratePostId, rateTargetUid, meetCounts, appMode]
  );

  const submitRate = useCallback(async () => {
    let stars = starV;
    if (!stars) stars = 3;
    const p = posts.find((x) => x.id === ratePostId);
    if (!p) return;

    if (appMode === 'live' && ratePostId && firebaseUser && profile) {
      try {
        const result = await submitRating(
          firebaseUser.uid,
          profile,
          String(ratePostId),
          p,
          stars
        );
        setRateOpen(false);
        toast(`+${result.auraGiven} AURA TO THEM · +${result.reviewerReward} TO YOU`);
      } catch (e) {
        toast(e instanceof Error ? e.message : 'rating failed');
      }
      return;
    }

    const given = auraGiven(stars, p.i, meetCounts);
    setMeetCounts((mc) => ({ ...mc, [p.i]: (mc[p.i] || 0) + 1 }));
    setMyAura((a) => a + REVIEWER_RWD);
    setAHist((h) => [
      {
        ico: 'ti-star',
        txt: `rated ${p.n} — ${stars}★ · gave ${given} aura`,
        pts: `+${REVIEWER_RWD}`,
        t: 'just now',
      },
      ...h,
    ]);
    if (myMeets >= 3) unlockBdg('connector');
    setRateOpen(false);
    toast(`+${given} AURA TO THEM · +${REVIEWER_RWD} TO YOU`);
  }, [
    starV,
    posts,
    ratePostId,
    meetCounts,
    myMeets,
    unlockBdg,
    toast,
    appMode,
    firebaseUser,
    profile,
  ]);

  const closeRate = useCallback(() => setRateOpen(false), []);

  const doSearch = useCallback((v: string) => setSearchQuery(v), []);

  useEffect(() => {
    if (appMode !== 'demo' || !user) return;
    const t = setInterval(() => {
      setPosts((prev) => {
        const next = prev
          .map((p) => (p.mins > 0 ? { ...p, mins: p.mins - 1 } : p))
          .filter((p) => p.mins > 0);
        return next;
      });
    }, 60000);
    return () => clearInterval(t);
  }, [user, appMode]);

  const value: AppContextValue = {
    screen,
    appMode,
    authLoading,
    authMode,
    pendingVerification,
    user,
    profile,
    firebaseUid: firebaseUser?.uid ?? null,
    myAura,
    filter,
    posts,
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
    demoLogin,
    doLogout,
    resendVerification: handleResendVerification,
    checkVerification,
    resetPassword: handleResetPassword,
    showAura,
    setFilterTab,
    doTabAndGo,
    vote,
    meetUp,
    openChatFromPost,
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
