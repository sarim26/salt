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
import { subscribeAuraEvents } from '../services/chats';
import { addComment, subscribeComments } from '../services/comments';
import {
  addParticipant,
  confirmMeetingDone,
  createPost,
  deletePost,
  removeParticipant,
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
  FilterTab,
  LeaderboardUser,
  Post,
  PostComment,
  Screen,
  User,
} from '../types';
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
  lb: LeaderboardUser[];
  myPosts: number;
  myMeets: number;
  aHist: AuraHistoryItem[];
  earnedBdg: Set<string>;
  ratedKeys: Set<string>;
  commentsForPost: Record<string, PostComment[]>;
  toastMsg: string;
  toastVisible: boolean;
  sheetOpen: boolean;
  rateOpen: boolean;
  ratePostId: string | null;
  rateTargetUid: string | null;
  rateWho: string;
  starV: number;
  loginError: string;
  postText: string;
  postTag: string;
  postLoc: string;
  postCapacity: number;
  loginEmail: string;
  loginPassword: string;
  searchQuery: string;
  setAuthMode: (m: 'signin' | 'signup') => void;
  setLoginEmail: (v: string) => void;
  setLoginPassword: (v: string) => void;
  setPostText: (v: string) => void;
  setPostTag: (v: string) => void;
  setPostLoc: (v: string) => void;
  setPostCapacity: (n: number) => void;
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
  ratePerson: (postId: string, targetUid: string, targetName: string) => void;
  sharePost: (id: string | number) => void;
  addPostComment: (postId: string, text: string, parentId?: string | null, replyToName?: string | null) => Promise<void>;
  subscribePostComments: (postId: string) => () => void;
  addParticipant: (postId: string, uid: string, name: string) => Promise<void>;
  removeParticipant: (postId: string, uid: string) => Promise<void>;
  confirmMeetingDone: (postId: string) => Promise<void>;
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
  const [lb, setLb] = useState<LeaderboardUser[]>([]);
  const [myPosts, setMyPosts] = useState(0);
  const [myMeets, setMyMeets] = useState(0);
  const [ratedKeys, setRatedKeys] = useState<Set<string>>(new Set());
  const [commentsForPost, setCommentsForPost] = useState<Record<string, PostComment[]>>({});
  const commentUnsubsRef = useRef<Record<string, () => void>>({});
  const [aHist, setAHist] = useState<AuraHistoryItem[]>([]);
  const [earnedBdg, setEarnedBdg] = useState<Set<string>>(new Set(INITIAL_BADGES));
  const [ratePostId, setRatePostId] = useState<string | null>(null);
  const [rateTargetUid, setRateTargetUid] = useState<string | null>(null);
  const [rateWho, setRateWho] = useState('');
  const [starV, setStarV] = useState(0);
  const [toastMsg, setToastMsg] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [rateOpen, setRateOpen] = useState(false);
  const profileRef = useRef<UserProfile | null>(null);
  profileRef.current = profile;
  const [loginError, setLoginError] = useState('');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [postText, setPostText] = useState('');
  const [postTag, setPostTag] = useState('food');
  const [postLoc, setPostLoc] = useState('');
  const [postCapacity, setPostCapacity] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [firestoreReady, setFirestoreReady] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const authWasSignedIn = useRef(false);
  const liveSessionUid = useRef<string | null>(null);
  const feedUnsubsRef = useRef<Array<() => void>>([]);
  const sessionGenRef = useRef(0);
  const voteIndexRef = useRef<Record<string, 1 | -1>>({});

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
    setLb([]);
    setMyAura(STARTING_AURA);
    setMyPosts(0);
    setMyMeets(0);
    setRatedKeys(new Set());
    setCommentsForPost({});
    Object.values(commentUnsubsRef.current).forEach((u) => u());
    commentUnsubsRef.current = {};
    setAHist([]);
    setEarnedBdg(new Set(INITIAL_BADGES));
    setFilter('all');
    setSearchQuery('');
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
        subscribeMyRatings(uid, setRatedKeys, onErr),
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
              if (next.length === 0 && prev.length > 0) return prev;
              return next;
            });
          },
          onErr
        ),
        subscribeLeaderboard(domain, setLb),
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
    if (!profile || !firebaseUser?.uid) return;
    applyPendingRatings(firebaseUser.uid).catch((e) => {
      const msg = firestoreErrorMessage(e);
      if (msg) toast(msg);
    });
  }, [profile, firebaseUser?.uid, toast]);

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
    let list = sortedPosts(posts, filter, user.ini);
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (p) =>
          p.body.toLowerCase().includes(q) ||
          p.n.toLowerCase().includes(q) ||
          p.tags.some((t) => t.includes(q))
      );
    }
    return list;
  }, [posts, filter, user, searchQuery]);

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

  const ratePerson = useCallback(
    (postId: string, targetUid: string, targetName: string) => {
      setRatePostId(postId);
      setRateTargetUid(targetUid);
      setRateWho(targetName.toUpperCase());
      setStarV(0);
      setRateOpen(true);
    },
    []
  );

  const subscribePostComments = useCallback(
    (postId: string) => {
      if (commentUnsubsRef.current[postId]) return () => commentUnsubsRef.current[postId]();
      const unsub = subscribeComments(
        postId,
        (comments) => setCommentsForPost((prev) => ({ ...prev, [postId]: comments })),
        (err) => {
          const msg = firestoreErrorMessage(err);
          if (msg) toast(msg);
        }
      );
      commentUnsubsRef.current[postId] = unsub;
      return () => {
        unsub();
        delete commentUnsubsRef.current[postId];
      };
    },
    [toast]
  );

  const addPostComment = useCallback(
    async (postId: string, text: string, parentId?: string | null, replyToName?: string | null) => {
      if (!firebaseUser || !profile) return;
      try {
        await addComment(postId, profile, firebaseUser.uid, text, parentId, replyToName);
        toast(parentId ? 'REPLY POSTED' : 'COMMENT POSTED');
      } catch (e) {
        toast(actionErrorMessage(e, 'could not post comment'));
      }
    },
    [firebaseUser, profile, toast]
  );

  const handleAddParticipant = useCallback(
    async (postId: string, uid: string, name: string) => {
      if (!firebaseUser) return;
      try {
        await addParticipant(postId, firebaseUser.uid, uid, name);
        toast('ADDED TO MEETUP');
      } catch (e) {
        toast(actionErrorMessage(e, 'could not add person'));
      }
    },
    [firebaseUser, toast]
  );

  const handleRemoveParticipant = useCallback(
    async (postId: string, uid: string) => {
      if (!firebaseUser) return;
      try {
        await removeParticipant(postId, firebaseUser.uid, uid);
        toast('REMOVED FROM MEETUP');
      } catch (e) {
        toast(actionErrorMessage(e, 'could not remove person'));
      }
    },
    [firebaseUser, toast]
  );

  const handleConfirmMeetingDone = useCallback(
    async (postId: string) => {
      if (!firebaseUser) return;
      try {
        await confirmMeetingDone(postId, firebaseUser.uid);
        toast('MEETING DONE — RATE EACH OTHER');
      } catch (e) {
        toast(actionErrorMessage(e, 'could not confirm meeting'));
      }
    },
    [firebaseUser, toast]
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
      await createPost(firebaseUser.uid, profile, txt, [postTag], loc || null, postCapacity);
      setPostText('');
      setPostLoc('');
      setSheetOpen(false);
      setFilter('all');
      toast(`POST IS LIVE — +${POST_AURA_REWARD} AURA · GONE IN 24H`);
    } catch (e) {
      const msg = firestoreErrorMessage(e);
      if (msg) toast(msg);
    }
  }, [postText, postTag, postLoc, postCapacity, toast, firebaseUser, profile]);

  const submitRate = useCallback(
    async (vibes: string[]) => {
      if (!starV) {
        toast('PICK A STAR RATING FIRST');
        return;
      }
      const p = ratePostId ? posts.find((x) => String(x.id) === ratePostId) : null;
      if (!p || !ratePostId || !rateTargetUid || !firebaseUser || !profile) return;

      try {
        await submitRating(
          firebaseUser.uid,
          profile,
          ratePostId,
          p,
          rateTargetUid,
          starV,
          vibes
        );
        setRatedKeys((prev) => new Set(prev).add(`${ratePostId}_${rateTargetUid}`));
        setRateOpen(false);
        setRatePostId(null);
        setRateTargetUid(null);
        setStarV(0);
        toast('RATING SUBMITTED');
      } catch (e) {
        toast(actionErrorMessage(e, 'could not submit rating'));
      }
    },
    [starV, posts, ratePostId, rateTargetUid, toast, firebaseUser, profile]
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
    lb,
    myPosts,
    myMeets,
    aHist,
    earnedBdg,
    ratedKeys,
    commentsForPost,
    toastMsg,
    toastVisible,
    sheetOpen,
    rateOpen,
    ratePostId,
    rateTargetUid,
    rateWho,
    starV,
    loginError,
    postText,
    postTag,
    postLoc,
    postCapacity,
    loginEmail,
    loginPassword,
    searchQuery,
    setAuthMode,
    setLoginEmail,
    setLoginPassword,
    setPostText,
    setPostTag,
    setPostLoc,
    setPostCapacity,
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
    ratePerson,
    sharePost,
    addPostComment,
    subscribePostComments,
    addParticipant: handleAddParticipant,
    removeParticipant: handleRemoveParticipant,
    confirmMeetingDone: handleConfirmMeetingDone,
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
