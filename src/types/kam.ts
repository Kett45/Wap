import type { Timestamp } from 'firebase/firestore';

export type StandardCardTypeId =
  | 'ATTENDANCE'
  | 'QUIET'
  | 'PARTICIPATION'
  | 'PRAISE'
  | 'GOLD'
  | 'MEMORIZATION'
  | 'CONFESSION';

export type CardTypeId = StandardCardTypeId | 'CUSTOM_ELDER';

export type CustomCardColorKey =
  | 'GOLD'
  | 'EMERALD'
  | 'SKY'
  | 'VIOLET'
  | 'INDIGO'
  | 'TEAL'
  | 'ROSE';

export type CustomCardFrequency = 'WEEKLY' | 'MONTHLY' | 'ONCE_EVER';

export type ThemeId = 'DARK' | 'LIGHT';
export type UiScaleMode = 'AUTO' | 'MANUAL';

export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'ISSUE';
export type ChildNoteType = 'COMMENT' | 'MEMORIZATION' | 'VISITATION';
export type VisitationStatus = 'VISITED' | 'FOLLOWUP' | 'NOT_VISITED';
export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED';

export interface CardDefinition {
  id: CardTypeId;
  titleAr: string;
  points: number;
  icon: string;
  colorKey: CustomCardColorKey;
  darkHex: string;
  lightHex: string;
}

export interface UserProfile {
  userId: string;
  displayName: string;
  email: string;
  groupId: string;
  joinedGroupIds?: string[];
  enabledCards: string[];
  collapsedBlockIds?: string[];
  hiddenBlockIds?: string[];
  compactViewMode?: boolean;
  themeId?: ThemeId | string;
  uiScaleMode?: UiScaleMode | string;
  uiScaleFactor?: number;
  showFloatingAddButton?: boolean;
  servantAliases?: Record<string, string>;
  createdAt?: Timestamp | Date | number;
  updatedAt?: Timestamp | Date | number;
}

export interface EmailDirectoryEntry {
  email: string;
  uid: string;
  displayName: string;
  updatedAt?: Timestamp | Date | number;
}

export interface Group {
  id: string; // == inviteCode
  inviteCode: string;
  name: string;
  adminId: string;
  adminName: string;
  assistantAdminIds?: string[];
  memberUids: string[];
  allowServantUndo: boolean;
  enforceWeeklyCardLimit: boolean;
  maxMonthlyPoints: number;
  attendanceIsCardOnly: boolean;
  showLeaderboard: boolean;
  autoStudentNumber: boolean;
  bannedUids?: string[];
  bannedServantEntries?: string[];
  dailyInviteToken?: string;
  inviteCodeUpdatedAtMillis?: number;
  avatarBase64?: string;
  avatarHash?: string;
  customCardEnabled?: boolean;
  customCardName?: string;
  customCardPoints?: number;
  customCardIcon?: string;
  customCardColorKey?: CustomCardColorKey | string;
  customCardFrequency?: CustomCardFrequency;
  createdAt?: Timestamp | Date | number;
  updatedAt?: Timestamp | Date | number;
}

export interface GroupInvitation {
  id: string;
  groupId: string;
  groupName: string;
  adminId: string;
  inviteeName: string;
  inviteCode: string;
  status: InvitationStatus;
  acceptedByUid: string;
  memberUids?: string[];
  createdAt?: Timestamp | Date | number;
  updatedAt?: Timestamp | Date | number;
}

export interface ServantBlock {
  id: string;
  groupId: string;
  servantId: string;
  servantName: string;
  colorHex: string;
  sortOrder: number;
  memberUids?: string[];
  createdAt?: Timestamp | Date | number;
  updatedAt?: Timestamp | Date | number;
}

export interface Student {
  id: string;
  groupId: string;
  name: string;
  studentNumber: number;
  blockId: string;
  sortOrder: number;
  position?: number;
  avatarInitials: string;
  avatarBase64?: string;
  hasAvatar?: boolean;
  avatarHash?: string;
  createdByUid: string;
  memberUids?: string[];
  lastMemorizedText?: string;
  lastMemorizedBy?: string;
  lastMemorizedAtMillis?: number;
  createdAt?: Timestamp | Date | number;
  updatedAt?: Timestamp | Date | number;
}

export interface StudentAvatarDoc {
  id: string; // == studentId
  groupId: string;
  studentId: string;
  avatarBase64: string;
  avatarHash: string;
  updatedByUid: string;
  memberUids?: string[];
  createdAt?: Timestamp | Date | number;
  updatedAt?: Timestamp | Date | number;
}

export interface CardEvent {
  id: string;
  groupId: string;
  studentId: string;
  studentName: string;
  cardType: CardTypeId;
  points: number;
  servantId: string;
  servantName: string;
  monthKey: string;
  weekKey: string;
  memberUids?: string[];
  createdAt?: Timestamp | Date | number;
  updatedAt?: Timestamp | Date | number;
}

export interface MonthlyBalance {
  id: string; // {monthKey}_{studentId}
  groupId: string;
  studentId: string;
  studentName: string;
  monthKey: string;
  totalPoints: number;
  eventsCount: number;
  lastUpdatedByUid: string;
  memberUids?: string[];
  createdAt?: Timestamp | Date | number;
  updatedAt?: Timestamp | Date | number;
}

export interface GroupMemberProfile {
  uid: string;
  groupId: string;
  displayName: string;
  email?: string;
  phone?: string;
  primaryPhone?: string;
  secondaryPhone?: string;
  phoneVerified: false;
  showPhone?: boolean;
  phoneHidden?: boolean;
  avatar?: string;
  hasAvatar?: boolean;
  avatarHash?: string;
  avatarBase64?: string;
  memberUids?: string[];
  lastSeenAt?: Timestamp | Date | number;
  createdAt?: Timestamp | Date | number;
  updatedAt?: Timestamp | Date | number;
}

export interface AttendanceRecord {
  id: string; // {weekKey}_{studentId}
  groupId?: string;
  studentId: string;
  studentName: string;
  status: AttendanceStatus;
  weekKey: string;
  servantId: string;
  servantName: string;
  note: string;
  memberUids: string[];
  createdAt?: Timestamp | Date | number;
  updatedAt?: Timestamp | Date | number;
}

export interface ChildNote {
  id: string;
  groupId: string;
  studentId: string;
  studentName: string;
  type: ChildNoteType;
  text: string;
  status?: VisitationStatus | string;
  authorUid: string;
  authorName: string;
  clientCreatedAtMillis?: number;
  memberUids?: string[];
  createdAt?: Timestamp | Date | number;
  updatedAt?: Timestamp | Date | number;
}

export interface DuplicateCardAlert {
  key: string;
  studentId: string;
  studentName: string;
  cardType: CardTypeId;
  weekKey: string;
  events: CardEvent[];
}
