import type { Timestamp } from 'firebase/firestore';

export type ChatMessageType = 'TEXT' | 'IMAGE' | 'AUDIO' | 'SYSTEM';

export type NotificationCategory =
  | 'CONFLICT'
  | 'ABSENT'
  | 'COMMENT'
  | 'VISITATION'
  | 'MEMORIZATION'
  | 'CARD'
  | 'SYSTEM';

export interface GroupChatMeta {
  groupId: string;
  memberUids: string[];
  lastMessageId?: string;
  lastMessageText?: string;
  lastMessageType?: ChatMessageType;
  lastMessageSenderUid?: string;
  lastMessageSenderName?: string;
  lastMessageAt?: Timestamp | Date | number;
  totalMessagesCount?: number;
  updatedAt?: Timestamp | Date | number;
}

export interface DmRoom {
  id: string; // dm_{uidA}_{uidB}
  chatId?: string;
  groupId?: string;
  participants: string[];
  participantNames?: Record<string, string>;
  lastMessageId?: string;
  lastMessageText?: string;
  lastMessageType?: ChatMessageType;
  lastMessageSenderUid?: string;
  lastMessageSenderName?: string;
  lastMessageAt?: Timestamp | Date | number;
  totalMessagesCount?: number;
  createdAt?: Timestamp | Date | number;
  updatedAt?: Timestamp | Date | number;
}

export interface ChatMessage {
  id: string;
  chatId?: string;
  groupId?: string;
  senderUid: string;
  senderName: string;
  type: ChatMessageType;
  text: string;
  mediaBase64?: string;
  mediaUrl?: string;
  mediaMimeType?: string;
  imageWidth?: number;
  imageHeight?: number;
  audioDurationSec?: number;
  notificationCategory?: NotificationCategory | string;
  childId?: string;
  childName?: string;
  childBlockName?: string;
  forwardedFromName?: string;
  isDeleted: boolean;
  memberUids?: string[];
  participants?: string[];
  createdAt?: Timestamp | Date | number;
  updatedAt?: Timestamp | Date | number;
}
