import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { ChatDoc, MessageDoc, UserProfile } from '../types/firestore';
import type { Chat, ChatMessage } from '../types';
import {
  chatIdFor,
  formatMessageTime,
  formatRelativeTime,
} from '../utils/firestoreMappers';

export function subscribeChats(
  uid: string,
  schoolDomain: string,
  onData: (chats: Chat[]) => void
): Unsubscribe {
  if (!db) return () => {};
  const q = query(
    collection(db, 'chats'),
    where('schoolDomain', '==', schoolDomain),
    where('participantUids', 'array-contains', uid),
    orderBy('lastAt', 'desc')
  );

  return onSnapshot(q, (snap) => {
    const chats: Chat[] = snap.docs.map((d) => {
      const data = d.data() as ChatDoc;
      const peerUid = data.participantUids.find((p) => p !== uid) || uid;
      return {
        id: d.id,
        peerUid,
        n: data.peerNames[peerUid] || 'Student',
        i: data.peerInitials[peerUid] || 'ST',
        av: data.peerAvatars?.[peerUid] ?? 0,
        aura: data.peerAuras?.[peerUid] ?? 0,
        preview: data.lastPreview,
        time: data.lastAt?.toDate ? formatRelativeTime(data.lastAt.toDate()) : 'now',
        unread: data.unread?.[uid] ?? false,
        msgs: [],
      };
    });
    onData(chats);
  });
}

export function subscribeMessages(
  chatId: string,
  uid: string,
  onData: (msgs: ChatMessage[]) => void
): Unsubscribe {
  if (!db) return () => {};
  const q = query(
    collection(db, 'chats', chatId, 'messages'),
    orderBy('createdAt', 'asc')
  );
  return onSnapshot(q, (snap) => {
    onData(
      snap.docs.map((d) => {
        const m = d.data() as MessageDoc;
        const date = m.createdAt?.toDate?.() ?? new Date();
        return {
          me: m.senderUid === uid,
          text: m.text,
          time: formatMessageTime(date),
        };
      })
    );
  });
}

export async function openChatWithUser(
  myUid: string,
  myProfile: UserProfile,
  peerUid: string,
  peerProfile: UserProfile
): Promise<string> {
  if (!db) throw new Error('Firebase not configured');
  const id = chatIdFor(myProfile.schoolDomain, myUid, peerUid);
  const ref = doc(db, 'chats', id);
  const existing = await getDoc(ref);
  if (!existing.exists()) {
    const chat: ChatDoc = {
      schoolDomain: myProfile.schoolDomain,
      participantUids: [myUid, peerUid].sort() as [string, string],
      lastPreview: '',
      lastAt: serverTimestamp() as ChatDoc['lastAt'],
      unread: { [myUid]: false, [peerUid]: false },
      peerNames: {
        [myUid]: myProfile.displayName,
        [peerUid]: peerProfile.displayName,
      },
      peerInitials: {
        [myUid]: myProfile.initials,
        [peerUid]: peerProfile.initials,
      },
      peerAuras: {
        [myUid]: myProfile.aura,
        [peerUid]: peerProfile.aura,
      },
      peerAvatars: {
        [myUid]: myProfile.avatarIndex,
        [peerUid]: peerProfile.avatarIndex,
      },
    };
    await setDoc(ref, chat);
  }
  return id;
}

export async function openChatFromPostAuthor(
  myUid: string,
  myProfile: UserProfile,
  authorUid: string
): Promise<string> {
  if (!db) throw new Error('Firebase not configured');
  const peerSnap = await getDoc(doc(db, 'users', authorUid));
  if (!peerSnap.exists()) throw new Error('Author not found');
  const peer = peerSnap.data() as UserProfile;
  return openChatWithUser(myUid, myProfile, authorUid, peer);
}

export async function sendMessage(
  chatId: string,
  senderUid: string,
  peerUid: string,
  text: string
): Promise<void> {
  if (!db) throw new Error('Firebase not configured');
  await addDoc(collection(db, 'chats', chatId, 'messages'), {
    senderUid,
    text,
    createdAt: serverTimestamp(),
  });
  await updateDoc(doc(db, 'chats', chatId), {
    lastPreview: text,
    lastAt: serverTimestamp(),
    [`unread.${peerUid}`]: true,
    [`unread.${senderUid}`]: false,
  });
}

export async function markChatRead(chatId: string, uid: string): Promise<void> {
  if (!db) return;
  await updateDoc(doc(db, 'chats', chatId), {
    [`unread.${uid}`]: false,
  });
}

export function subscribeAuraEvents(
  uid: string,
  onData: (events: { ico: string; txt: string; pts: string; t: string }[]) => void
): Unsubscribe {
  if (!db) return () => {};
  const q = query(
    collection(db, 'users', uid, 'auraEvents'),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(q, (snap) => {
    onData(
      snap.docs.map((d) => {
        const e = d.data();
        const date = e.createdAt?.toDate?.() ?? new Date();
        return {
          ico: e.ico,
          txt: e.txt,
          pts: e.pts,
          t: formatRelativeTime(date),
        };
      })
    );
  });
}
