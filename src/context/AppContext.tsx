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
import { isFirebaseConfigured, auth } from '../lib/firebase';
import {
  logOut as firebaseLogOut,
  resetPassword,
  signIn,
  signUp,
  awaitAuthForFirestore,
  deleteAccount as firebaseDeleteAccount,
} from '../services/auth';
import {
  markChatRead,
  openChatFromPostAuthor,
  openChatWithPeer,
  sendMessage,
  subscribeAuraEvents,
  subscribeChats,
  subscribeMessages,
} from '../services/chats';
import {
  confirmMeetRequest,
  declineMeetRequest,
  sendMeetRequest,
  subscribeIncomingMeetRequests,
  subscribeOutgoingMeetRequests,
} from '../services/meetRequests';
import {
  createPost,
  deletePost,
  setVote,
  subscribeFeed,
  subscribeLeaderboard,
  subscribeMyPosts,
  subscribeProfile,
  subscribeVoteIndex,
} from '../services/posts';
import {
  applyPendingRatings,
  submitRating,
  subscribeMyRatings,
  subscribePendingRatings,
} from '../services/ratings';
import { uploadAvatar } from '../services/users';
import { sharePost as sharePostUtil } from '../utils/share';
import type { UserProfile } from '../types/firestore';
import type {
  AppMode,
  AuraHistoryItem,
  Chat,
  ChatMessage,
  FilterTab,
  IncomingMeetRequest,
  LeaderboardUser,
  MeetStatus,
  Post,
  Screen,
  User,
} from '../types';
import type { MeetRequestStatus } from '../types/firestore';
import { actionErrorMessage, firestoreErrorMessage } from '../utils/firestoreErrors';
import { emailDomain } from '../utils/firestoreMappers';
import { STARTING_AURA, POST_AURA_REWARD } from '../constants';
import {
  lvl,
  sortedPosts,
  tagAff,
} from '../utils/helpers';

interface AppContextValue {
  screen: Screen;
  appMode: AppMode;
  authLoading: boolean;
  sessionReady: boolean;
  bootstrapError: string;
  authMode: 'signin' | 'signup';
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
  meetConfirmOpen: boolean;
  meetConfirmWho: string;
  meetConfirmSending: boolean;
  incomingMeetRequests: IncomingMeetRequest[];
  ratePostId: string | number | null;
  rateWho: string;
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
  resetPassword: () => void;
  showAura: () => void;
  setFilterTab: (f: FilterTab) => void;
  doTabAndGo: (f: FilterTab) => void;
  vote: (id: string | number, d: number) => void;
  meetUp: (id: string | number) => void;
  rateMeetUp: (id: string | number) => void;
  cancelMeetConfirm: () => void;
  confirmSendMeetRequest: () => void;
  confirmMeet: (requestId: string) => void;
  declineMeet: (requestId: string) => void;
  openChatWithPeer: (peerUid: string, postId: string) => void;
  openChatFromPost: (id: string | number) => void;
  sharePost: (id: string | number) => void;
  openChatD: (id: string | number) => void;
  sendMsg: (text: string) => void;
  openSheet: () => void;
  openSheetWith: (t: string) => void;
  closeSheet: (targetId?: string) => void;
  doPost: () => void;
  submitRate: (vibes: string[]) => void;
  deletePost: (id: string) => Promise<void>;
  getSortedPosts: () => Post[];
  getTagAff: () => Record<string, number>;
  doSearch: (v: string) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

const INITIAL_BADGES = new Set(['verified student']);

function resolveMeetStatus(
  postId: string | number,
  rated: Set<string | number>,
  outgoing: Record<string, MeetRequestStatus>
): MeetStatus {
  if (rated.has(postId)) return 'rated';
  const status = outgoing[String(postId)];
  if (status === 'pending') return 'pending';
  if (status === 'confirmed') return 'confirmed';
  return 'none';
}

function withMeetStatus(
  posts: Post[],
  rated: Set<string | number>,
  outgoing: Record<string, MeetRequestStatus>
): Post[] {
  return posts.map((p) => {
    const meetStatus = resolveMeetStatus(p.id, rated, outgoing);
    return {
      ...p,
      meetStatus,
      met: meetStatus === 'rated',
    };
  });
}

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
  const { firebaseUser, loading: authLoading } = useAuthState();

  const [appMode, setAppMode] = useState<AppMode>(null);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [bootstrapError, setBootstrapError] = useState('');
  const [screen, setScreen] = useState<Screen>('login');
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [myAura, setMyAura] = useState(STARTING_AURA);
  const [filter, setFilter] = useState<FilterTab>('all');
  const [posts, setPosts] = useState<Post[]>([]);
  const [myPostHistory, setMyPostHistory] = useState<Post[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChatMessages, setCurrentChatMessages] = useState<ChatMessage[]>([]);
  const [lb, setLb] = useState<LeaderboardUser[]>([]);
  const [myPosts, setMyPosts] = useState(0);
  const [myMeets, setMyMeets] = useState(0);
  const [metPostIds, setMetPostIds] = useState<Set<string | number>>(new Set());
  const [myMeetByPost, setMyMeetByPost] = useState<Record<string, MeetRequestStatus>>({});
  const [incomingMeetRequests, setIncomingMeetRequests] = useState<IncomingMeetRequest[]>([]);
  const [aHist, setAHist] = useState<AuraHistoryItem[]>([]);
  const [earnedBdg, setEarnedBdg] = useState<Set<string>>(new Set(INITIAL_BADGES));
  const [curChat, setCurChat] = useState<string | number | null>(null);
  const [ratePostId, setRatePostId] = useState<string | number | null>(null);
  const [rateWho, setRateWho] = useState('');
  const [starV, setStarV] = useState(0);
  const [toastMsg, setToastMsg] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [rateOpen, setRateOpen] = useState(false);
  const [meetConfirmOpen, setMeetConfirmOpen] = useState(false);
  const [meetConfirmPostId, setMeetConfirmPostId] = useState<string | number | null>(null);
  const [meetConfirmWho, setMeetConfirmWho] = useState('');
  const [meetConfirmSending, setMeetConfirmSending] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [postText, setPostText] = useState('');
  const [postTag, setPostTag] = useState('food');
  const [postLoc, setPostLoc] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [firestoreReady, setFirestoreReady] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const authWasSignedIn = useRef(false);
  const liveSessionUid = useRef<string | null>(null);
  const feedUnsubsRef = useRef<Array<() => void>>([]);
  const sessionGenRef = useRef(0);
  const voteIndexRef = useRef<Record<string, 1 | -1>>({});
  const metPostIdsRef = useRef(metPostIds);
  const myMeetByPostRef = useRef(myMeetByPost);
  metPostIdsRef.current = metPostIds;
  myMeetByPostRef.current = myMeetByPost;

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
    setPosts([]);
    setMyPostHistory([]);
    setChats([]);
    setCurrentChatMessages([]);
    setLb([]);
    setMyAura(STARTING_AURA);
    setMyPosts(0);
    setMyMeets(0);
    setMetPostIds(new Set());
    setMyMeetByPost({});
    setIncomingMeetRequests([]);
    setMeetConfirmOpen(false);
    setMeetConfirmPostId(null);
    setMeetConfirmWho('');
    setAHist([]);
    setEarnedBdg(new Set(INITIAL_BADGES));
    setCurChat(null);
    setFilter('all');
    setBootstrapError('');
    setScreen('login');
  }, []);

  const applyProfile = useCallback((p: UserProfile) => {
    setProfile(p);
    setUser(profileToUser(p));
    setMyAura(p.aura);
    setMyPosts(p.postCount);
    setMyMeets(p.meetCount);
    setEarnedBdg(new Set(p.badges || []));
  }, []);

  const doLogin = useCallback(async () => {
    if (!isFirebaseConfigured) {
      setLoginError('app not configured — firebase keys missing');
      return;
    }

    setLoginError('');
    try {
      if (authMode === 'signup') {
        await signUp(loginEmail, loginPassword);
      } else {
        await signIn(loginEmail, loginPassword);
      }
    } catch (e) {
      setLoginError(e instanceof Error ? e.message : 'authentication failed');
    }
  }, [loginEmail, loginPassword, authMode]);

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

    if (firebaseUser) {
      authWasSignedIn.current = true;
      return;
    }

    if (!authWasSignedIn.current) return;

    // Confirm sign-out — ignore transient null during token refresh / reload.
    void auth?.authStateReady().then(() => {
      if (auth?.currentUser) return;
      authWasSignedIn.current = false;
      liveSessionUid.current = null;
      feedUnsubsRef.current.forEach((u) => u());
      feedUnsubsRef.current = [];
      resetSession();
    });
  }, [firebaseUser, authLoading, resetSession]);

  useEffect(() => {
    if (profile) setAppMode('live');
  }, [profile]);

  useEffect(() => {
    if (!firebaseUser) return;

    const uid = firebaseUser.uid;
    setBootstrapError('');
    return subscribeProfile(
      uid,
      firebaseUser.email,
      (p) => {
        if (p) {
          applyProfile(p);
          setAppMode('live');
          setScreen((s) => (s === 'login' ? 'feed' : s));
          setBootstrapError('');
        }
      },
      (err) => {
        const msg = firestoreErrorMessage(err);
        if (!msg) return;
        setBootstrapError(msg);
        toast(msg);
      }
    );
  }, [firebaseUser?.uid, firebaseUser?.email, applyProfile, toast]);

  useEffect(() => {
    if (!firebaseUser || user) return;
    const timer = setTimeout(() => {
      setBootstrapError(
        'still setting up your profile — try signing out and back in'
      );
    }, 15000);
    return () => clearTimeout(timer);
  }, [firebaseUser, user]);

  useEffect(() => {
    if (!firebaseUser || !profile) {
      if (!firebaseUser) {
        setFirestoreReady(false);
        liveSessionUid.current = null;
        feedUnsubsRef.current.forEach((u) => u());
        feedUnsubsRef.current = [];
      }
      return;
    }

    const uid = firebaseUser.uid;
    const domain = emailDomain(firebaseUser.email || profile.email) || profile.schoolDomain;
    if (!domain) return;

    if (liveSessionUid.current && liveSessionUid.current !== uid) {
      setPosts([]);
      setMyPostHistory([]);
      setChats([]);
      setLb([]);
    }

    // Keep one live listener set per uid — avoid tearing down feed on token/profile refresh.
    if (liveSessionUid.current === uid && feedUnsubsRef.current.length > 0) {
      setFirestoreReady(true);
      return;
    }

    liveSessionUid.current = uid;
    feedUnsubsRef.current.forEach((u) => u());
    feedUnsubsRef.current = [];

    const gen = ++sessionGenRef.current;
    setFirestoreReady(false);

    void (async () => {
      try {
        await awaitAuthForFirestore();
      } catch {
        /* still attempt listeners */
      }
      if (sessionGenRef.current !== gen) return;

      setFirestoreReady(true);
      const onErr = (err: Error) => {
        const msg = firestoreErrorMessage(err);
        if (msg) toast(msg);
      };

      feedUnsubsRef.current = [
        subscribeVoteIndex(
          uid,
          (votes) => {
            voteIndexRef.current = votes;
            setPosts((prev) =>
              prev.map((p) => ({
                ...p,
                uv: votes[String(p.id)] ?? 0,
              }))
            );
          },
          onErr
        ),
        subscribeMyRatings(
          uid,
          (postIds) => {
            setMetPostIds(new Set(postIds));
          },
          onErr
        ),
        subscribeOutgoingMeetRequests(
          uid,
          (byPost) => {
            setMyMeetByPost(byPost);
          },
          (_postId, from, to) => {
            if (from === 'pending' && to === 'confirmed') {
              toast('MEET CONFIRMED — RATE YOUR MEETUP');
            }
          },
          onErr
        ),
        subscribeIncomingMeetRequests(uid, setIncomingMeetRequests, onErr),
        subscribeFeed(
          domain,
          () => voteIndexRef.current,
          (feedPosts) => {
            setPosts((prev) => {
              const votes = voteIndexRef.current;
              const next = feedPosts.map((p) => ({
                ...p,
                uv: votes[String(p.id)] ?? 0,
              }));
              const merged = withMeetStatus(
                next,
                metPostIdsRef.current,
                myMeetByPostRef.current
              );
              if (merged.length === 0 && prev.length > 0) return prev;
              return merged;
            });
          },
          onErr
        ),
        subscribeLeaderboard(domain, setLb),
        subscribeChats(uid, domain, setChats, onErr),
        subscribeAuraEvents(uid, setAHist, onErr),
        subscribePendingRatings(
          uid,
          (count) => {
            if (count > 0) toast(`${count} NEW RATING${count > 1 ? 'S' : ''} RECEIVED`);
          },
          onErr
        ),
        subscribeMyPosts(uid, setMyPostHistory, onErr),
      ];
    })();
  }, [firebaseUser?.uid, profile?.schoolDomain, profile?.email, toast]);

  useEffect(() => {
    setPosts((prev) => withMeetStatus(prev, metPostIds, myMeetByPost));
  }, [metPostIds, myMeetByPost]);

  const incomingNotifiedRef = useRef(false);
  useEffect(() => {
    if (!firestoreReady || incomingNotifiedRef.current) return;
    if (incomingMeetRequests.length > 0) {
      incomingNotifiedRef.current = true;
      toast(
        `${incomingMeetRequests.length} MEET REQUEST${incomingMeetRequests.length > 1 ? 'S' : ''} — CHECK CHATS`
      );
    }
  }, [incomingMeetRequests.length, firestoreReady, toast]);

  useEffect(() => {
    if (!profile || !firebaseUser?.uid) return;
    applyPendingRatings(firebaseUser.uid).catch((e) => {
      const msg = firestoreErrorMessage(e);
      if (msg) toast(msg);
    });
  }, [profile, firebaseUser?.uid, toast]);

  useEffect(() => {
    if (!firebaseUser || !curChat) {
      setCurrentChatMessages([]);
      return;
    }
    return subscribeMessages(
      String(curChat),
      firebaseUser.uid,
      setCurrentChatMessages,
      (err) => {
        const msg = firestoreErrorMessage(err);
        if (msg) toast(msg);
      }
    );
  }, [firebaseUser, curChat, toast]);

  useEffect(() => {
    if (!firebaseUser || !curChat) return;
    markChatRead(String(curChat), firebaseUser.uid);
  }, [firebaseUser, curChat, currentChatMessages.length]);

  const goScreen = useCallback(
    (n: Screen) => {
      if (!user && !firebaseUser && n !== 'login') return;
      setScreen(n);
      if (n === 'explore') setSearchQuery('');
    },
    [user, firebaseUser]
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

      if (!firebaseUser) return;

      if (p.authorUid && p.authorUid === firebaseUser.uid) {
        toast('YOU CANNOT MEET ON YOUR OWN POST');
        return;
      }

      if (!p.authorUid) {
        toast('CANNOT MEET ON THIS POST');
        return;
      }

      if (metPostIdsRef.current.has(id) || p.meetStatus === 'rated') {
        toast('ALREADY RATED THIS MEETUP');
        return;
      }

      if (p.meetStatus === 'pending') {
        toast('REQUEST ALREADY SENT');
        return;
      }

      if (p.meetStatus === 'confirmed') {
        setRatePostId(id);
        setStarV(0);
        setRateWho(p.n.toUpperCase());
        setRateOpen(true);
        return;
      }

      setMeetConfirmPostId(id);
      setMeetConfirmWho(p.n.toUpperCase());
      setMeetConfirmOpen(true);
    },
    [posts, firebaseUser, toast]
  );

  const rateMeetUp = useCallback(
    (id: string | number) => {
      const p = posts.find((x) => x.id === id);
      if (!p) return;
      if (!firebaseUser) return;
      if (p.meetStatus !== 'confirmed') {
        toast('WAIT FOR THEM TO CONFIRM THE MEETUP');
        return;
      }
      setRatePostId(id);
      setStarV(0);
      setRateWho(p.n.toUpperCase());
      setRateOpen(true);
    },
    [posts, firebaseUser, toast]
  );

  const cancelMeetConfirm = useCallback(() => {
    if (meetConfirmSending) return;
    setMeetConfirmOpen(false);
    setMeetConfirmPostId(null);
    setMeetConfirmWho('');
  }, [meetConfirmSending]);

  const confirmSendMeetRequest = useCallback(async () => {
    const id = meetConfirmPostId;
    const p = id != null ? posts.find((x) => x.id === id) : null;
    if (!p || !firebaseUser || !profile) return;

    setMeetConfirmSending(true);
    try {
      await sendMeetRequest(firebaseUser.uid, profile, p);
      setMeetConfirmOpen(false);
      setMeetConfirmPostId(null);
      setMeetConfirmWho('');
      toast('REQUEST SENT ✓');
    } catch (e) {
      toast(actionErrorMessage(e, 'could not send meet request'));
    } finally {
      setMeetConfirmSending(false);
    }
  }, [meetConfirmPostId, posts, firebaseUser, profile, toast]);

  const confirmMeet = useCallback(
    async (requestId: string) => {
      if (!firebaseUser) return;
      try {
        await confirmMeetRequest(requestId, firebaseUser.uid);
        toast('MEET CONFIRMED');
      } catch (e) {
        toast(actionErrorMessage(e, 'could not confirm meet'));
      }
    },
    [firebaseUser, toast]
  );

  const declineMeet = useCallback(
    async (requestId: string) => {
      if (!firebaseUser) return;
      try {
        await declineMeetRequest(requestId, firebaseUser.uid);
        toast('REQUEST DISMISSED');
      } catch (e) {
        toast(actionErrorMessage(e, 'could not dismiss request'));
      }
    },
    [firebaseUser, toast]
  );

  const handleOpenChatWithPeer = useCallback(
    async (peerUid: string, postId: string) => {
      if (!firebaseUser || !profile) return;
      try {
        const chatId = await openChatWithPeer(
          firebaseUser.uid,
          profile,
          peerUid,
          postId
        );
        setCurChat(chatId);
        setScreen('chat-detail');
      } catch (e) {
        const msg = firestoreErrorMessage(e);
        if (msg) toast(msg);
      }
    },
    [firebaseUser, profile, toast]
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
        const msg = firestoreErrorMessage(e);
        if (msg) toast(msg);
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
    if (!txt) {
      toast('WRITE SOMETHING FIRST');
      return;
    }
    if (!firebaseUser || !profile) {
      toast('STILL LOADING — TRY AGAIN');
      return;
    }
    const loc = postLoc.trim();

    try {
      await createPost(firebaseUser.uid, profile, txt, [postTag], loc || null);
      setPostText('');
      setPostLoc('');
      setSheetOpen(false);
      setFilter('all');
      toast(`POST IS LIVE — +${POST_AURA_REWARD} AURA · GONE IN 24H`);
    } catch (e) {
      const msg = firestoreErrorMessage(e);
      if (msg) toast(msg);
    }
  }, [postText, postTag, postLoc, toast, firebaseUser, profile]);

  const submitRate = useCallback(
    async (vibes: string[]) => {
      if (!starV) {
        toast('PICK A STAR RATING FIRST');
        return;
      }
      const p = posts.find((x) => x.id === ratePostId);
      if (!p) return;

      if (!ratePostId || !firebaseUser || !profile) return;
      if (p.authorUid && p.authorUid === firebaseUser.uid) {
        toast('YOU CANNOT RATE YOUR OWN POST');
        setRateOpen(false);
        return;
      }
      if (p.meetStatus !== 'confirmed' && !metPostIdsRef.current.has(ratePostId)) {
        toast('MEET MUST BE CONFIRMED BEFORE RATING');
        setRateOpen(false);
        return;
      }
      try {
        await submitRating(
          firebaseUser.uid,
          profile,
          String(ratePostId),
          p,
          starV,
          vibes
        );
        setMetPostIds((prev) => new Set(prev).add(ratePostId));
        setPosts((prev) =>
          prev.map((x) =>
            x.id === ratePostId
              ? { ...x, met: true, meetStatus: 'rated' as const }
              : x
          )
        );
        setRateOpen(false);
        setRatePostId(null);
        setStarV(0);
        toast('RATING SUBMITTED');
      } catch (e) {
        toast(actionErrorMessage(e, 'could not submit rating'));
      }
    },
    [starV, posts, ratePostId, toast, firebaseUser, profile]
  );

  const removePost = useCallback(
    async (id: string) => {
      if (!firebaseUser) return;
      try {
        await deletePost(id, firebaseUser.uid);
        toast('POST DELETED');
      } catch (e) {
        toast(actionErrorMessage(e, 'could not delete post'));
      }
    },
    [firebaseUser, toast]
  );

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

  const value: AppContextValue = {
    screen,
    appMode,
    authLoading,
    sessionReady: firestoreReady,
    bootstrapError,
    authMode,
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
    meetConfirmOpen,
    meetConfirmWho,
    meetConfirmSending,
    incomingMeetRequests,
    ratePostId,
    rateWho,
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
    setStarV,
    goScreen,
    doLogin,
    doLogout,
    deleteAccount,
    uploadProfilePhoto,
    resetPassword: handleResetPassword,
    showAura,
    setFilterTab,
    doTabAndGo,
    vote,
    meetUp,
    rateMeetUp,
    cancelMeetConfirm,
    confirmSendMeetRequest,
    confirmMeet,
    declineMeet,
    openChatWithPeer: handleOpenChatWithPeer,
    openChatFromPost,
    sharePost,
    openChatD,
    sendMsg,
    openSheet,
    openSheetWith,
    closeSheet,
    doPost,
    submitRate,
    deletePost: removePost,
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
