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
import type {
  AuraHistoryItem,
  Chat,
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
  user: User | null;
  myAura: number;
  filter: FilterTab;
  posts: Post[];
  chats: Chat[];
  lb: LeaderboardUser[];
  myPosts: number;
  myMeets: number;
  aHist: AuraHistoryItem[];
  earnedBdg: Set<string>;
  curChat: number | null;
  toastMsg: string;
  toastVisible: boolean;
  sheetOpen: boolean;
  rateOpen: boolean;
  ratePostId: number | null;
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
  showAura: () => void;
  setFilterTab: (f: FilterTab) => void;
  doTabAndGo: (f: FilterTab) => void;
  vote: (id: number, d: number) => void;
  meetUp: (id: number) => void;
  openChatFromPost: (id: number) => void;
  openChatD: (id: number) => void;
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

export function AppProvider({ children }: { children: ReactNode }) {
  const [screen, setScreen] = useState<Screen>('login');
  const [user, setUser] = useState<User | null>(null);
  const [myAura, setMyAura] = useState(247);
  const [filter, setFilter] = useState<FilterTab>('all');
  const [posts, setPosts] = useState<Post[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [lb, setLb] = useState<LeaderboardUser[]>([]);
  const [myPosts, setMyPosts] = useState(0);
  const [myMeets, setMyMeets] = useState(0);
  const [meetCounts, setMeetCounts] = useState<Record<string, number>>({});
  const [aHist, setAHist] = useState<AuraHistoryItem[]>([]);
  const [earnedBdg, setEarnedBdg] = useState<Set<string>>(new Set(INITIAL_BADGES));
  const [curChat, setCurChat] = useState<number | null>(null);
  const [nid, setNid] = useState(999);
  const [ratePostId, setRatePostId] = useState<number | null>(null);
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

  const loginAs = useCallback((dom: string) => {
    const data = UNIVERSITIES[dom];
    if (!data) return;
    setUser({ domain: dom, ...data });
    setMyAura(247);
    setMyPosts(0);
    setMyMeets(0);
    setMeetCounts({});
    setAHist([]);
    setFilter('all');
    setPosts(JSON.parse(JSON.stringify(data.posts)) as Post[]);
    setChats(JSON.parse(JSON.stringify(data.chats)) as Chat[]);
    setLb(JSON.parse(JSON.stringify(data.lb)) as LeaderboardUser[]);
    setEarnedBdg(new Set(INITIAL_BADGES));
    setScreen('feed');
  }, []);

  const doLogin = useCallback(() => {
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
    loginAs(dom);
  }, [loginEmail, loginPassword, loginAs]);

  const demoLogin = useCallback(
    (u: string) => {
      const dom = DEMO_DOMAINS[u];
      if (dom) loginAs(dom);
    },
    [loginAs]
  );

  const doLogout = useCallback(() => {
    setUser(null);
    setScreen('login');
    setLoginEmail('');
    setLoginPassword('');
    setLoginError('');
  }, []);

  const goScreen = useCallback(
    (n: Screen) => {
      if (!user && n !== 'login') return;
      setScreen(n);
      if (n === 'explore') setSearchQuery('');
    },
    [user]
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

  const vote = useCallback((id: number, d: number) => {
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        if (p.uv === d) return { ...p, score: p.score - d, uv: 0 };
        return { ...p, score: p.score + (d - p.uv), uv: d };
      })
    );
  }, []);

  const meetUp = useCallback(
    (id: number) => {
      setPosts((prev) => {
        const p = prev.find((x) => x.id === id);
        if (p) {
          setTimeout(() => {
            setRatePostId(id);
            setStarV(0);
            setRateWho(p.n.toUpperCase());
            setRateDecay(decayNote(p.i, meetCounts));
            setRatePointsLabel('select stars to see aura given');
            setRateOpen(true);
          }, 400);
        }
        return prev.map((x) => (x.id === id ? { ...x, met: true } : x));
      });
      setMyMeets((m) => m + 1);
    },
    [meetCounts]
  );

  const openChatFromPost = useCallback(
    (id: number) => {
      const p = posts.find((x) => x.id === id);
      if (!p) return;
      setChats((prev) => {
        let c = prev.find((x) => x.n === p.n);
        if (c) {
          setCurChat(c.id);
          setScreen('chat-detail');
          return prev.map((ch) => (ch.id === c!.id ? { ...ch, unread: false } : ch));
        }
        const newChat: Chat = {
          id: prev.length + 100,
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
    [posts]
  );

  const openChatD = useCallback((id: number) => {
    setChats((prev) => prev.map((c) => (c.id === id ? { ...c, unread: false } : c)));
    setCurChat(id);
    setScreen('chat-detail');
  }, []);

  const sendMsg = useCallback(
    (text: string) => {
      const txt = text.trim();
      if (!txt || curChat == null) return;
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
    [curChat]
  );

  const openSheet = useCallback(() => setSheetOpen(true), []);
  const openSheetWith = useCallback((t: string) => {
    setPostTag(t);
    setSheetOpen(true);
  }, []);
  const closeSheet = useCallback((targetId?: string) => {
    if (targetId === 'sheet' || targetId === undefined) setSheetOpen(false);
  }, []);

  const doPost = useCallback(() => {
    const txt = postText.trim();
    if (!txt || !user) return;
    const loc = postLoc.trim();
    setMyPosts((n) => {
      const next = n + 1;
      if (next === 1) unlockBdg('first post');
      return next;
    });
    setPosts((prev) => [
      {
        id: nid,
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
  }, [postText, postTag, postLoc, user, myAura, nid, unlockBdg, toast]);

  const setStarWithFeedback = useCallback(
    (n: number) => {
      setStarV(n);
      const p = posts.find((x) => x.id === ratePostId);
      if (p) {
        setRatePointsLabel(`GIVES THEM ${auraGiven(n, p.i, meetCounts)} AURA PTS`);
      }
    },
    [posts, ratePostId, meetCounts]
  );

  const submitRate = useCallback(() => {
    let stars = starV;
    if (!stars) stars = 3;
    const p = posts.find((x) => x.id === ratePostId);
    if (!p) return;
    const given = auraGiven(stars, p.i, meetCounts);
    setMeetCounts((mc) => ({ ...mc, [p.i]: (mc[p.i] || 0) + 1 }));
    setMyAura((a) => a + REVIEWER_RWD);
    setAHist((h) =>
      [
        {
          ico: 'ti-star',
          txt: `rated ${p.n} — ${stars}★ · gave ${given} aura`,
          pts: `+${REVIEWER_RWD}`,
          t: 'just now',
        },
        ...h,
      ]
    );
    if (myMeets >= 3) unlockBdg('connector');
    setRateOpen(false);
    toast(`+${given} AURA TO THEM · +${REVIEWER_RWD} TO YOU`);
  }, [starV, posts, ratePostId, meetCounts, myMeets, unlockBdg, toast]);

  const closeRate = useCallback(() => setRateOpen(false), []);

  const doSearch = useCallback((v: string) => setSearchQuery(v), []);

  useEffect(() => {
    if (!user) return;
    const t = setInterval(() => {
      setPosts((prev) => {
        const next = prev.map((p) => (p.mins > 0 ? { ...p, mins: p.mins - 1 } : p)).filter((p) => p.mins > 0);
        return next;
      });
    }, 60000);
    return () => clearInterval(t);
  }, [user]);

  const value: AppContextValue = {
    screen,
    user,
    myAura,
    filter,
    posts,
    chats,
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
