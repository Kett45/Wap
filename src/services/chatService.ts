import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  startAfter,
  updateDoc,
  type QueryDocumentSnapshot,
  type DocumentData,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { buildDmChatId } from '../lib/kamRules';
import type { Group } from '../types/kam';
import type { ChatMessage, ChatMessageType, NotificationCategory } from '../types/chat';

export const CHAT_PAGE_SIZE = 30;

function previewTextForMeta(type: ChatMessageType, text: string): string {
  if (type === 'IMAGE') return '📷 صورة';
  if (type === 'AUDIO') return '🎤 رسالة صوتية';
  if (text.startsWith('[ATTENDANCE_V3]') || text.startsWith('[ATTENDANCE_V2]')) {
    return '📋 تقرير التحضير / الكروت';
  }
  if (text.startsWith('[VISITATION_V1]')) {
    return '🏠 تقرير الافتقاد';
  }
  return text.slice(0, 200);
}

export async function sendGroupMessage(params: {
  group: Group;
  senderUid: string;
  senderName: string;
  type: ChatMessageType;
  text: string;
  mediaBase64?: string;
  mediaMimeType?: string;
  imageWidth?: number;
  imageHeight?: number;
  audioDurationSec?: number;
  notificationCategory?: NotificationCategory;
  childId?: string;
  childName?: string;
  childBlockName?: string;
  forwardedFromName?: string;
}): Promise<string> {
  const maxTextLen = params.type === 'SYSTEM' ? 4000 : 1000;
  const cleanText = params.text.trim().slice(0, maxTextLen);
  if (!cleanText) throw new Error('محتوى الرسالة فارغ.');

  const memberUids = Array.from(new Set([...params.group.memberUids, params.senderUid])).slice(0, 50);
  const msgRef = doc(collection(db, 'groups', params.group.id, 'messages'));

  const payload: Record<string, unknown> = {
    chatId: params.group.id,
    groupId: params.group.id,
    senderUid: params.senderUid,
    senderName: params.senderName.trim().slice(0, 100) || 'خادم',
    type: params.type,
    text: cleanText,
    isDeleted: false,
    memberUids,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (params.type === 'IMAGE') {
    if (!params.mediaBase64 || params.mediaBase64.length > 460000) {
      throw new Error('حجم الصورة يتجاوز الحد المسموح.');
    }
    payload.mediaBase64 = params.mediaBase64;
    if (params.mediaMimeType) payload.mediaMimeType = params.mediaMimeType.slice(0, 60);
    if (typeof params.imageWidth === 'number')
      payload.imageWidth = Math.max(0, Math.min(1600, Math.round(params.imageWidth)));
    if (typeof params.imageHeight === 'number')
      payload.imageHeight = Math.max(0, Math.min(1600, Math.round(params.imageHeight)));
  } else if (params.type === 'AUDIO') {
    if (!params.mediaBase64 || params.mediaBase64.length > 100000) {
      throw new Error('حجم الرسالة الصوتية يتجاوز الحد المسموح (100KB).');
    }
    const dur = Math.max(1, Math.min(30, Math.round(params.audioDurationSec ?? 1)));
    payload.mediaBase64 = params.mediaBase64;
    if (params.mediaMimeType) payload.mediaMimeType = params.mediaMimeType.slice(0, 60);
    payload.audioDurationSec = dur;
  }

  if (params.notificationCategory) payload.notificationCategory = params.notificationCategory;
  if (params.childId) payload.childId = params.childId.slice(0, 80);
  if (params.childName) payload.childName = params.childName.slice(0, 100);
  if (params.childBlockName) payload.childBlockName = params.childBlockName.slice(0, 100);
  if (params.forwardedFromName) payload.forwardedFromName = params.forwardedFromName.slice(0, 100);

  await setDoc(msgRef, payload);

  const metaRef = doc(db, 'groups', params.group.id, 'chatMeta', 'main');
  const metaSnap = await getDoc(metaRef);
  const preview = previewTextForMeta(params.type, cleanText);

  if (metaSnap.exists()) {
    await updateDoc(metaRef, {
      groupId: params.group.id,
      memberUids,
      lastMessageId: msgRef.id,
      lastMessageText: preview,
      lastMessageType: params.type,
      lastMessageSenderUid: params.senderUid,
      lastMessageSenderName: params.senderName.trim().slice(0, 100) || 'خادم',
      lastMessageAt: serverTimestamp(),
      totalMessagesCount: increment(1),
      updatedAt: serverTimestamp(),
    });
  } else {
    await setDoc(metaRef, {
      groupId: params.group.id,
      memberUids,
      lastMessageId: msgRef.id,
      lastMessageText: preview,
      lastMessageType: params.type,
      lastMessageSenderUid: params.senderUid,
      lastMessageSenderName: params.senderName.trim().slice(0, 100) || 'خادم',
      lastMessageAt: serverTimestamp(),
      totalMessagesCount: 1,
      updatedAt: serverTimestamp(),
    });
  }

  return msgRef.id;
}

export async function sendGroupSystemMessage(params: {
  group: Group;
  senderUid: string;
  senderName: string;
  text: string;
  notificationCategory?: NotificationCategory;
  childId?: string;
  childName?: string;
  childBlockName?: string;
}): Promise<string> {
  return sendGroupMessage({
    ...params,
    type: 'SYSTEM',
  });
}

// Strictly complies with isValidLiveSystemReportUpdate: ONLY text and updatedAt modified!
export async function updateLiveSystemReportMessage(
  groupId: string,
  messageId: string,
  newText: string
): Promise<void> {
  const cleanText = newText.trim().slice(0, 4000);
  if (!cleanText) return;
  await updateDoc(doc(db, 'groups', groupId, 'messages', messageId), {
    text: cleanText,
    updatedAt: serverTimestamp(),
  });
}

// Strictly complies with isValidChatMessageSoftDelete: text MUST be 'تم حذف الرسالة'
export async function softDeleteGroupMessage(groupId: string, messageId: string): Promise<void> {
  await updateDoc(doc(db, 'groups', groupId, 'messages', messageId), {
    isDeleted: true,
    text: 'تم حذف الرسالة',
    mediaBase64: '',
    updatedAt: serverTimestamp(),
  });
}

export async function fetchOlderGroupMessages(
  groupId: string,
  cursorDoc: QueryDocumentSnapshot<DocumentData>
): Promise<{ messages: ChatMessage[]; lastDoc: QueryDocumentSnapshot<DocumentData> | null }> {
  const q = query(
    collection(db, 'groups', groupId, 'messages'),
    orderBy('createdAt', 'desc'),
    startAfter(cursorDoc),
    limit(CHAT_PAGE_SIZE)
  );
  const snap = await getDocs(q);
  const messages = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ChatMessage);
  const lastDoc = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null;
  return { messages, lastDoc };
}

export async function ensureDmRoom(params: {
  currentUid: string;
  currentName: string;
  otherUid: string;
  otherName: string;
  groupId?: string;
}): Promise<string> {
  const chatId = buildDmChatId(params.currentUid, params.otherUid);
  const participants = [params.currentUid, params.otherUid].sort();
  const roomRef = doc(db, 'dms', chatId);
  const snap = await getDoc(roomRef);

  if (!snap.exists()) {
    await setDoc(roomRef, {
      chatId,
      ...(params.groupId ? { groupId: params.groupId.slice(0, 40) } : {}),
      participants,
      participantNames: {
        [params.currentUid]: params.currentName.trim().slice(0, 100) || 'خادم',
        [params.otherUid]: params.otherName.trim().slice(0, 100) || 'خادم',
      },
      totalMessagesCount: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  return chatId;
}

export async function sendDmMessage(params: {
  chatId: string;
  participants: string[];
  participantNames?: Record<string, string>;
  groupId?: string;
  senderUid: string;
  senderName: string;
  type: ChatMessageType;
  text: string;
  mediaBase64?: string;
  mediaMimeType?: string;
  imageWidth?: number;
  imageHeight?: number;
  audioDurationSec?: number;
  forwardedFromName?: string;
}): Promise<string> {
  const maxTextLen = params.type === 'SYSTEM' ? 4000 : 1000;
  const cleanText = params.text.trim().slice(0, maxTextLen);
  if (!cleanText) throw new Error('محتوى الرسالة فارغ.');

  const sortedParticipants = [...params.participants].sort();
  if (sortedParticipants.length !== 2) throw new Error('المحادثة الخاصة تتطلب طرفين فقط.');

  const msgRef = doc(collection(db, 'dms', params.chatId, 'messages'));
  const payload: Record<string, unknown> = {
    chatId: params.chatId,
    ...(params.groupId ? { groupId: params.groupId.slice(0, 40) } : {}),
    senderUid: params.senderUid,
    senderName: params.senderName.trim().slice(0, 100) || 'خادم',
    type: params.type,
    text: cleanText,
    isDeleted: false,
    participants: sortedParticipants,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (params.type === 'IMAGE') {
    if (!params.mediaBase64 || params.mediaBase64.length > 460000) {
      throw new Error('حجم الصورة يتجاوز الحد المسموح.');
    }
    payload.mediaBase64 = params.mediaBase64;
    if (params.mediaMimeType) payload.mediaMimeType = params.mediaMimeType.slice(0, 60);
    if (typeof params.imageWidth === 'number')
      payload.imageWidth = Math.max(0, Math.min(1600, Math.round(params.imageWidth)));
    if (typeof params.imageHeight === 'number')
      payload.imageHeight = Math.max(0, Math.min(1600, Math.round(params.imageHeight)));
  } else if (params.type === 'AUDIO') {
    if (!params.mediaBase64 || params.mediaBase64.length > 100000) {
      throw new Error('حجم الرسالة الصوتية يتجاوز الحد المسموح.');
    }
    payload.mediaBase64 = params.mediaBase64;
    if (params.mediaMimeType) payload.mediaMimeType = params.mediaMimeType.slice(0, 60);
    payload.audioDurationSec = Math.max(1, Math.min(30, Math.round(params.audioDurationSec ?? 1)));
  }

  if (params.forwardedFromName) {
    payload.forwardedFromName = params.forwardedFromName.slice(0, 100);
  }

  await setDoc(msgRef, payload);

  const roomRef = doc(db, 'dms', params.chatId);
  const roomSnap = await getDoc(roomRef);
  const preview = previewTextForMeta(params.type, cleanText);

  if (roomSnap.exists()) {
    await updateDoc(roomRef, {
      lastMessageId: msgRef.id,
      lastMessageText: preview,
      lastMessageType: params.type,
      lastMessageSenderUid: params.senderUid,
      lastMessageSenderName: params.senderName.trim().slice(0, 100) || 'خادم',
      lastMessageAt: serverTimestamp(),
      totalMessagesCount: increment(1),
      updatedAt: serverTimestamp(),
    });
  } else {
    await setDoc(roomRef, {
      chatId: params.chatId,
      ...(params.groupId ? { groupId: params.groupId.slice(0, 40) } : {}),
      participants: sortedParticipants,
      participantNames: params.participantNames ?? {},
      lastMessageId: msgRef.id,
      lastMessageText: preview,
      lastMessageType: params.type,
      lastMessageSenderUid: params.senderUid,
      lastMessageSenderName: params.senderName.trim().slice(0, 100) || 'خادم',
      lastMessageAt: serverTimestamp(),
      totalMessagesCount: 1,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  return msgRef.id;
}

export async function softDeleteDmMessage(chatId: string, messageId: string): Promise<void> {
  await updateDoc(doc(db, 'dms', chatId, 'messages', messageId), {
    isDeleted: true,
    text: 'تم حذف الرسالة',
    mediaBase64: '',
    updatedAt: serverTimestamp(),
  });
}

export async function fetchOlderDmMessages(
  chatId: string,
  cursorDoc: QueryDocumentSnapshot<DocumentData>
): Promise<{ messages: ChatMessage[]; lastDoc: QueryDocumentSnapshot<DocumentData> | null }> {
  const q = query(
    collection(db, 'dms', chatId, 'messages'),
    orderBy('createdAt', 'desc'),
    startAfter(cursorDoc),
    limit(CHAT_PAGE_SIZE)
  );
  const snap = await getDocs(q);
  const messages = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ChatMessage);
  const lastDoc = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null;
  return { messages, lastDoc };
}

export function getLocalReadCount(roomKey: string): number {
  try {
    const raw = localStorage.getItem(`kam_read_${roomKey}`);
    return raw ? Math.max(0, Number.parseInt(raw, 10) || 0) : 0;
  } catch {
    return 0;
  }
}

export function setLocalReadCount(roomKey: string, count: number): void {
  try {
    localStorage.setItem(`kam_read_${roomKey}`, String(Math.max(0, count)));
  } catch {
    // ignore storage quota errors
  }
}
