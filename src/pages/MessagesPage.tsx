import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Forward,
  Mail,
  MessageSquarePlus,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import type { DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';
import { useKam } from '../context/KamContext';
import { AvatarBadge } from '../components/ui/AvatarBadge';
import { SystemReportCard } from '../components/chat/SystemReportCards';
import { MediaComposer } from '../components/chat/MediaComposer';
import { ChildProfileModal } from '../components/students/ChildProfileModal';
import { formatClockAr, formatRelativeTimeAr, isServantOnline } from '../lib/arabic';
import { normalizeBase64ImageSrc } from '../lib/media';
import { CHAT_PAGE_SIZE, getLocalReadCount, setLocalReadCount } from '../services/chatService';
import type { ChatMessage, DmRoom } from '../types/chat';

export const MessagesPage: React.FC = () => {
  const {
    group,
    userProfile,
    students,
    blocks,
    members,
    chatMeta,
    groupMessages,
    hasMoreGroupMessages,
    dmRooms,
    getServantDisplayName,
    sendGroupChatMessage,
    softDeleteGroupMsg,
    loadOlderGroupMessages,
    startDmWithUser,
    startDmByEmail,
    subscribeDmMessages,
    sendDmChatMessage,
    softDeleteDmMsg,
    loadOlderDmMessages,
    updateProfile,
    showToast,
  } = useKam();

  const [activeRoom, setActiveRoom] = useState<'GROUP' | string>('GROUP');
  const [mobileShowThread, setMobileShowThread] = useState(false);

  const [dmMessages, setDmMessages] = useState<ChatMessage[]>([]);
  const [olderDmMessages, setOlderDmMessages] = useState<ChatMessage[]>([]);
  const [dmCursor, setDmCursor] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMoreDm, setHasMoreDm] = useState(false);

  const [newDmModalOpen, setNewDmModalOpen] = useState(false);
  const [emailQuery, setEmailQuery] = useState('');
  const [searchingEmail, setSearchingEmail] = useState(false);

  const [membersModalOpen, setMembersModalOpen] = useState(false);
  const [aliasDrafts, setAliasDrafts] = useState<Record<string, string>>({});

  const [forwardingMsg, setForwardingMsg] = useState<ChatMessage | null>(null);
  const [profileStudentId, setProfileStudentId] = useState<string | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement | null>(null);

  const activeDmRoom: DmRoom | null = useMemo(
    () => (activeRoom === 'GROUP' ? null : dmRooms.find((r) => r.id === activeRoom) ?? null),
    [activeRoom, dmRooms]
  );

  useEffect(() => {
    if (activeRoom === 'GROUP') {
      setDmMessages([]);
      setOlderDmMessages([]);
      setDmCursor(null);
      setHasMoreDm(false);
      return;
    }
    setOlderDmMessages([]);
    const unsub = subscribeDmMessages(activeRoom, (msgs, lastDoc) => {
      setDmMessages(msgs);
      setDmCursor(lastDoc);
      setHasMoreDm(msgs.length === CHAT_PAGE_SIZE);
    });
    return () => unsub();
  }, [activeRoom, subscribeDmMessages]);

  useEffect(() => {
    if (activeRoom === 'GROUP' && group && chatMeta?.totalMessagesCount !== undefined) {
      setLocalReadCount(`grp_${group.id}`, chatMeta.totalMessagesCount);
    } else if (activeDmRoom && activeDmRoom.totalMessagesCount !== undefined) {
      setLocalReadCount(`dm_${activeDmRoom.id}`, activeDmRoom.totalMessagesCount);
    }
  }, [
    activeRoom,
    group?.id,
    chatMeta?.totalMessagesCount,
    activeDmRoom?.id,
    activeDmRoom?.totalMessagesCount,
  ]);

  const displayedMessages = useMemo(() => {
    const raw =
      activeRoom === 'GROUP'
        ? groupMessages
        : (() => {
            if (olderDmMessages.length === 0) return dmMessages;
            const seen = new Set(dmMessages.map((m) => m.id));
            return [...dmMessages, ...olderDmMessages.filter((m) => !seen.has(m.id))];
          })();
    return [...raw].reverse();
  }, [activeRoom, groupMessages, dmMessages, olderDmMessages]);

  const getDmOtherName = (room: DmRoom): { uid: string; name: string } => {
    const otherUid = room.participants.find((u) => u !== userProfile?.userId) ?? '';
    const fallback = room.participantNames?.[otherUid] || 'خادم';
    return {
      uid: otherUid,
      name: getServantDisplayName(otherUid, fallback),
    };
  };

  const groupUnread = group
    ? Math.max(0, (chatMeta?.totalMessagesCount ?? 0) - getLocalReadCount(`grp_${group.id}`))
    : 0;

  const handleStartDmByEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailQuery.trim()) return;
    setSearchingEmail(true);
    try {
      const { chatId, otherName } = await startDmByEmail(emailQuery.trim());
      setEmailQuery('');
      setNewDmModalOpen(false);
      setActiveRoom(chatId);
      setMobileShowThread(true);
      showToast(`تم فتح محادثة خاصة مع ${otherName}`, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'تعذر البحث بالبريد الإلكتروني', 'error');
    } finally {
      setSearchingEmail(false);
    }
  };

  const handleOpenServantDm = async (uid: string, name: string) => {
    try {
      const chatId = await startDmWithUser(uid, name);
      setNewDmModalOpen(false);
      setActiveRoom(chatId);
      setMobileShowThread(true);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'تعذر فتح المحادثة', 'error');
    }
  };

  const handleForwardTo = async (target: 'GROUP' | DmRoom) => {
    if (!forwardingMsg) return;
    try {
      const senderLabel = getServantDisplayName(forwardingMsg.senderUid, forwardingMsg.senderName);
      if (target === 'GROUP') {
        await sendGroupChatMessage({
          type: forwardingMsg.type === 'SYSTEM' ? 'TEXT' : forwardingMsg.type,
          text: forwardingMsg.text.slice(0, 1000),
          mediaBase64: forwardingMsg.mediaBase64,
          mediaMimeType: forwardingMsg.mediaMimeType,
          imageWidth: forwardingMsg.imageWidth,
          imageHeight: forwardingMsg.imageHeight,
          audioDurationSec: forwardingMsg.audioDurationSec,
          forwardedFromName: senderLabel,
        });
      } else {
        await sendDmChatMessage({
          chatId: target.id,
          participants: target.participants,
          participantNames: target.participantNames,
          type: forwardingMsg.type === 'SYSTEM' ? 'TEXT' : forwardingMsg.type,
          text: forwardingMsg.text.slice(0, 1000),
          mediaBase64: forwardingMsg.mediaBase64,
          mediaMimeType: forwardingMsg.mediaMimeType,
          imageWidth: forwardingMsg.imageWidth,
          imageHeight: forwardingMsg.imageHeight,
          audioDurationSec: forwardingMsg.audioDurationSec,
          forwardedFromName: senderLabel,
        });
      }
      showToast('تمت إعادة توجيه الرسالة', 'success');
      setForwardingMsg(null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'تعذر إعادة التوجيه', 'error');
    }
  };

  const handleSaveAliases = async () => {
    const cleaned: Record<string, string> = {};
    for (const [k, v] of Object.entries(aliasDrafts)) {
      if (v.trim()) cleaned[k] = v.trim().slice(0, 60);
    }
    await updateProfile({ servantAliases: cleaned });
    showToast('تم حفظ الأسماء المستعارة الشخصية', 'success');
    setMembersModalOpen(false);
  };

  const selectedStudentForModal = useMemo(
    () => students.find((s) => s.id === profileStudentId) ?? null,
    [students, profileStudentId]
  );

  return (
    <div className="h-[calc(100dvh-8.75rem)] md:h-[calc(100vh-3rem)] rounded-2xl border border-[var(--kam-border)] bg-[var(--kam-surface)] overflow-hidden grid grid-cols-1 md:grid-cols-12">
      {/* Sidebar: Group Chat + DMs */}
      <aside
        className={`md:col-span-4 lg:col-span-4 border-l border-[var(--kam-border)] flex flex-col overflow-hidden ${
          mobileShowThread ? 'hidden md:flex' : 'flex'
        }`}
      >
        <div className="px-4 py-3 border-b border-[var(--kam-border)] flex items-center justify-between gap-2">
          <h1 className="text-base font-extrabold">المحادثات</h1>
          <button
            type="button"
            onClick={() => setNewDmModalOpen(true)}
            className="min-h-[38px] px-3 py-1.5 rounded-xl bg-[var(--kam-primary)] text-white text-xs font-bold flex items-center gap-1.5 whitespace-nowrap"
          >
            <MessageSquarePlus className="w-3.5 h-3.5" />
            <span>رسالة خاصة</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto kam-scrollbar divide-y divide-[var(--kam-border)]">
          {/* Pinned Group Chat */}
          <button
            type="button"
            onClick={() => {
              setActiveRoom('GROUP');
              setMobileShowThread(true);
            }}
            className={`w-full min-h-[68px] px-4 py-3 text-right flex items-center gap-3 transition-colors ${
              activeRoom === 'GROUP'
                ? 'bg-[var(--kam-primary-container)]/60'
                : 'hover:bg-[var(--kam-surface-variant)]/50'
            }`}
          >
            <AvatarBadge
              directBase64={group?.avatarBase64}
              name={group?.name || 'شات الفصل'}
              size="md"
              accentColor="#5E6AD2"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold truncate">شات الفصل الجماعي</span>
                {chatMeta?.lastMessageAt && (
                  <span className="text-[0.7rem] text-[var(--kam-text-muted)] shrink-0">
                    {formatRelativeTimeAr(chatMeta.lastMessageAt)}
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between gap-2 mt-0.5">
                <p className="text-xs text-[var(--kam-text-muted)] truncate">
                  {chatMeta?.lastMessageText || 'ابدأ المحادثة مع خدام الفصل'}
                </p>
                {groupUnread > 0 && activeRoom !== 'GROUP' && (
                  <span className="px-1.5 py-0.5 rounded-md bg-[var(--kam-primary)] text-white font-num text-[0.65rem] font-bold shrink-0">
                    {groupUnread}
                  </span>
                )}
              </div>
            </div>
          </button>

          {/* 1-to-1 DM Rooms */}
          {dmRooms.map((room) => {
            const other = getDmOtherName(room);
            const otherMember = members.find((m) => m.uid === other.uid);
            const online = otherMember ? isServantOnline(otherMember.lastSeenAt) : false;
            const unread = Math.max(
              0,
              (room.totalMessagesCount ?? 0) - getLocalReadCount(`dm_${room.id}`)
            );

            return (
              <button
                key={room.id}
                type="button"
                onClick={() => {
                  setActiveRoom(room.id);
                  setMobileShowThread(true);
                }}
                className={`w-full min-h-[68px] px-4 py-3 text-right flex items-center gap-3 transition-colors ${
                  activeRoom === room.id
                    ? 'bg-[var(--kam-primary-container)]/60'
                    : 'hover:bg-[var(--kam-surface-variant)]/50'
                }`}
              >
                <AvatarBadge
                  directBase64={otherMember?.avatarBase64 || otherMember?.avatar}
                  name={other.name}
                  size="md"
                  online={online}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold truncate">{other.name}</span>
                    {room.lastMessageAt && (
                      <span className="text-[0.7rem] text-[var(--kam-text-muted)] shrink-0">
                        {formatRelativeTimeAr(room.lastMessageAt)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <p className="text-xs text-[var(--kam-text-muted)] truncate">
                      {room.lastMessageText || 'محادثة خاصة جديدة'}
                    </p>
                    {unread > 0 && activeRoom !== room.id && (
                      <span className="px-1.5 py-0.5 rounded-md bg-[var(--kam-primary)] text-white font-num text-[0.65rem] font-bold shrink-0">
                        {unread}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      {/* Main Thread */}
      <section
        className={`md:col-span-8 lg:col-span-8 flex flex-col overflow-hidden bg-[var(--kam-bg)]/40 ${
          mobileShowThread ? 'flex' : 'hidden md:flex'
        }`}
      >
        {/* Thread Header */}
        <div className="px-3.5 py-2.5 border-b border-[var(--kam-border)] bg-[var(--kam-surface)] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => setMobileShowThread(false)}
              aria-label="العودة لقائمة المحادثات"
              className="md:hidden min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl border border-[var(--kam-border)]"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
            <div className="min-w-0">
              <h2 className="text-sm font-extrabold truncate">
                {activeRoom === 'GROUP'
                  ? `${group?.name || 'الفصل'} — شات جماعي`
                  : activeDmRoom
                  ? getDmOtherName(activeDmRoom).name
                  : 'محادثة خاصة'}
              </h2>
              <p className="text-[0.7rem] text-[var(--kam-text-muted)]">
                {activeRoom === 'GROUP' ? `${members.length} خادم في الفصل` : 'محادثة خاصة بين خادمين'}
              </p>
            </div>
          </div>

          {activeRoom === 'GROUP' && (
            <button
              type="button"
              onClick={() => {
                setAliasDrafts(userProfile?.servantAliases ?? {});
                setMembersModalOpen(true);
              }}
              className="min-h-[38px] px-3 py-1.5 rounded-xl bg-[var(--kam-surface-variant)] border border-[var(--kam-border)] text-xs font-semibold flex items-center gap-1.5 shrink-0"
            >
              <Users className="w-3.5 h-3.5 text-[var(--kam-primary)]" />
              <span>الأعضاء</span>
            </button>
          )}
        </div>

        {/* Messages Stream */}
        <div className="flex-1 overflow-y-auto kam-scrollbar p-3.5 space-y-3">
          {((activeRoom === 'GROUP' && hasMoreGroupMessages) ||
            (activeRoom !== 'GROUP' && hasMoreDm)) && (
            <div className="text-center">
              <button
                type="button"
                onClick={async () => {
                  if (activeRoom === 'GROUP') {
                    await loadOlderGroupMessages();
                  } else if (dmCursor) {
                    const res = await loadOlderDmMessages(activeRoom, dmCursor);
                    setOlderDmMessages((prev) => [...prev, ...res.messages]);
                    setDmCursor(res.lastDoc);
                    setHasMoreDm(res.messages.length === CHAT_PAGE_SIZE);
                  }
                }}
                className="min-h-[38px] px-4 py-1.5 rounded-xl text-xs font-semibold border border-[var(--kam-border)] bg-[var(--kam-surface)] hover:border-[var(--kam-primary)]"
              >
                تحميل رسائل أقدم
              </button>
            </div>
          )}

          {displayedMessages.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-[var(--kam-text-muted)]">
              لا توجد رسائل بعد. ابدأ بكتابة أول رسالة.
            </div>
          ) : (
            displayedMessages.map((msg) => {
              const isMine = msg.senderUid === userProfile?.userId;
              const senderLabel = getServantDisplayName(msg.senderUid, msg.senderName);

              if (msg.type === 'SYSTEM' && !msg.isDeleted) {
                return (
                  <div key={msg.id} className="flex flex-col items-center gap-1">
                    <SystemReportCard
                      message={msg}
                      students={students}
                      blocks={blocks}
                      onSelectStudent={(sid) => setProfileStudentId(sid)}
                    />
                    <span className="text-[0.65rem] text-[var(--kam-text-muted)]">
                      {formatClockAr(msg.createdAt)}
                    </span>
                  </div>
                );
              }

              const imageSrc =
                msg.type === 'IMAGE' && msg.mediaBase64
                  ? normalizeBase64ImageSrc(msg.mediaBase64)
                  : '';

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isMine ? 'items-start' : 'items-end'}`}
                >
                  <div
                    className={`max-w-[86%] sm:max-w-[70%] rounded-2xl px-3.5 py-2.5 border ${
                      isMine
                        ? 'bg-[var(--kam-primary)] text-white border-transparent'
                        : 'bg-[var(--kam-surface)] text-[var(--kam-text-primary)] border-[var(--kam-border)]'
                    }`}
                  >
                    {!isMine && activeRoom === 'GROUP' && (
                      <div className="text-[0.72rem] font-bold text-[var(--kam-primary)] mb-1">
                        {senderLabel}
                      </div>
                    )}

                    {msg.forwardedFromName && !msg.isDeleted && (
                      <div className="text-[0.68rem] opacity-80 mb-1 flex items-center gap-1">
                        <Forward className="w-3 h-3" />
                        <span>محوّلة من: {msg.forwardedFromName}</span>
                      </div>
                    )}

                    {msg.isDeleted ? (
                      <p className="text-xs italic opacity-75">تم حذف الرسالة</p>
                    ) : (
                      <>
                        {imageSrc && (
                          <button
                            type="button"
                            onClick={() => setLightboxSrc(imageSrc)}
                            aria-label="عرض الصورة بالحجم الكامل"
                            className="block mb-1.5 rounded-xl overflow-hidden bg-black/20"
                          >
                            <img
                              src={imageSrc}
                              alt={msg.text || 'صورة'}
                              referrerPolicy="no-referrer"
                              className="max-h-72 rounded-xl object-contain"
                            />
                          </button>
                        )}
                        {msg.type === 'AUDIO' && msg.mediaBase64 && (
                          <audio
                            controls
                            src={`data:${msg.mediaMimeType || 'audio/webm'};base64,${msg.mediaBase64}`}
                            className="max-w-full mb-1.5"
                          />
                        )}
                        <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                          {msg.text}
                        </p>
                      </>
                    )}

                    <div className="mt-1.5 flex items-center justify-between gap-3 text-[0.68rem] opacity-80">
                      <span>{formatClockAr(msg.createdAt)}</span>
                      {!msg.isDeleted && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setForwardingMsg(msg)}
                            aria-label="إعادة توجيه الرسالة"
                            className="p-1.5 rounded-lg hover:bg-black/15"
                          >
                            <Forward className="w-3.5 h-3.5" />
                          </button>
                          {isMine && (
                            <button
                              type="button"
                              onClick={async () => {
                                if (activeRoom === 'GROUP') {
                                  await softDeleteGroupMsg(msg.id);
                                } else {
                                  await softDeleteDmMsg(activeRoom, msg.id);
                                }
                              }}
                              aria-label="حذف رسالتي"
                              className="p-1.5 rounded-lg hover:bg-black/15"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        {/* Composer */}
        <MediaComposer
          onError={(m) => showToast(m, 'error')}
          onSend={async (payload) => {
            if (activeRoom === 'GROUP') {
              await sendGroupChatMessage(payload);
            } else if (activeDmRoom) {
              await sendDmChatMessage({
                chatId: activeDmRoom.id,
                participants: activeDmRoom.participants,
                participantNames: activeDmRoom.participantNames,
                ...payload,
              });
            }
          }}
        />
      </section>

      {/* Image Fullscreen Lightbox */}
      {lightboxSrc && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="معاينة الصورة"
          onClick={() => setLightboxSrc(null)}
        >
          <button
            type="button"
            onClick={() => setLightboxSrc(null)}
            aria-label="إغلاق المعاينة"
            className="absolute top-4 left-4 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full bg-white/15 text-white"
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={lightboxSrc}
            alt="معاينة الصورة بالحجم الكامل"
            className="max-w-full max-h-[85dvh] rounded-2xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* New DM Bottom Sheet / Modal */}
      {newDmModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="بدء محادثة خاصة جديدة"
        >
          <div className="w-full max-w-md rounded-t-3xl sm:rounded-2xl bg-[var(--kam-surface)] border border-[var(--kam-border)] overflow-hidden shadow-2xl">
            <div className="sm:hidden w-10 h-1.5 rounded-full bg-[var(--kam-border-strong)] mx-auto mt-2.5" />
            <div className="px-5 py-3.5 border-b border-[var(--kam-border)] flex items-center justify-between">
              <h3 className="text-sm font-bold">بدء محادثة خاصة جديدة</h3>
              <button
                type="button"
                onClick={() => setNewDmModalOpen(false)}
                aria-label="إغلاق"
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-[var(--kam-text-muted)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-5">
              <form onSubmit={handleStartDmByEmail} className="space-y-2">
                <label
                  htmlFor="dm-email-search"
                  className="block text-xs font-semibold text-[var(--kam-text-secondary)]"
                >
                  البحث بالبريد الإلكتروني لخادم مسجل
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Mail className="w-4 h-4 text-[var(--kam-text-muted)] absolute right-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="dm-email-search"
                      type="email"
                      dir="ltr"
                      value={emailQuery}
                      onChange={(e) => setEmailQuery(e.target.value)}
                      placeholder="name@gmail.com"
                      className="w-full min-h-[44px] pr-9 pl-3 py-2 rounded-xl bg-[var(--kam-surface-variant)] border border-[var(--kam-border)] text-sm"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={searchingEmail || !emailQuery.trim()}
                    className="min-h-[44px] px-4 py-2 rounded-xl bg-[var(--kam-primary)] text-white text-xs font-bold disabled:opacity-50"
                  >
                    بحث
                  </button>
                </div>
              </form>

              <div className="space-y-2">
                <div className="text-xs font-semibold text-[var(--kam-text-secondary)]">
                  أو اختر خادماً من الفصل الحالي:
                </div>
                <div className="max-h-56 overflow-y-auto kam-scrollbar divide-y divide-[var(--kam-border)] rounded-xl border border-[var(--kam-border)]">
                  {members
                    .filter((m) => m.uid !== userProfile?.userId)
                    .map((m) => (
                      <button
                        key={m.uid}
                        type="button"
                        onClick={() => handleOpenServantDm(m.uid, m.displayName)}
                        className="w-full min-h-[48px] px-3.5 py-2.5 flex items-center justify-between hover:bg-[var(--kam-surface-variant)] text-right"
                      >
                        <div className="flex items-center gap-2.5">
                          <AvatarBadge
                            directBase64={m.avatarBase64 || m.avatar}
                            name={m.displayName}
                            size="xs"
                            online={isServantOnline(m.lastSeenAt)}
                          />
                          <span className="text-xs font-bold">
                            {getServantDisplayName(m.uid, m.displayName)}
                          </span>
                        </div>
                        <span className="text-xs text-[var(--kam-primary)] font-semibold">
                          مراسلة
                        </span>
                      </button>
                    ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Forward Message Bottom Sheet / Modal */}
      {forwardingMsg && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="إعادة توجيه الرسالة"
        >
          <div className="w-full max-w-sm rounded-t-3xl sm:rounded-2xl bg-[var(--kam-surface)] border border-[var(--kam-border)] overflow-hidden shadow-2xl">
            <div className="sm:hidden w-10 h-1.5 rounded-full bg-[var(--kam-border-strong)] mx-auto mt-2.5" />
            <div className="px-4 py-3.5 border-b border-[var(--kam-border)] flex items-center justify-between">
              <h3 className="text-sm font-bold">إعادة توجيه إلى</h3>
              <button
                type="button"
                onClick={() => setForwardingMsg(null)}
                aria-label="إغلاق"
                className="min-h-[38px] min-w-[38px] flex items-center justify-center text-[var(--kam-text-muted)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3 space-y-2 max-h-72 overflow-y-auto kam-scrollbar">
              <button
                type="button"
                onClick={() => handleForwardTo('GROUP')}
                className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl text-right text-xs font-bold hover:bg-[var(--kam-surface-variant)] border border-[var(--kam-border)]"
              >
                شات الفصل الجماعي ({group?.name})
              </button>
              {dmRooms.map((room) => (
                <button
                  key={room.id}
                  type="button"
                  onClick={() => handleForwardTo(room)}
                  className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl text-right text-xs font-bold hover:bg-[var(--kam-surface-variant)] border border-[var(--kam-border)]"
                >
                  {getDmOtherName(room).name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Members & Personal Servant Aliases Bottom Sheet / Modal */}
      {membersModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="أعضاء الفصل والأسماء المستعارة"
        >
          <div className="w-full max-w-md rounded-t-3xl sm:rounded-2xl bg-[var(--kam-surface)] border border-[var(--kam-border)] overflow-hidden shadow-2xl">
            <div className="sm:hidden w-10 h-1.5 rounded-full bg-[var(--kam-border-strong)] mx-auto mt-2.5" />
            <div className="px-5 py-3.5 border-b border-[var(--kam-border)] flex items-center justify-between">
              <h3 className="text-sm font-bold">خدام الفصل والأسماء المستعارة الخاصة بك</h3>
              <button
                type="button"
                onClick={() => setMembersModalOpen(false)}
                aria-label="إغلاق"
                className="min-h-[38px] min-w-[38px] flex items-center justify-center text-[var(--kam-text-muted)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3 max-h-80 overflow-y-auto kam-scrollbar">
              {members.map((m) => (
                <div key={m.uid} className="space-y-1">
                  <div className="text-xs font-bold">{m.displayName}</div>
                  <input
                    type="text"
                    maxLength={60}
                    value={aliasDrafts[m.uid] ?? ''}
                    onChange={(e) =>
                      setAliasDrafts((prev) => ({ ...prev, [m.uid]: e.target.value }))
                    }
                    placeholder="اسم مستعار يظهر لك فقط (اختياري)..."
                    className="w-full min-h-[42px] px-3 py-1.5 rounded-xl bg-[var(--kam-surface-variant)] border border-[var(--kam-border)] text-xs"
                  />
                </div>
              ))}
            </div>
            <div className="px-5 py-3 border-t border-[var(--kam-border)] flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setMembersModalOpen(false)}
                className="min-h-[40px] px-4 py-2 rounded-xl text-xs font-semibold border border-[var(--kam-border)]"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleSaveAliases}
                className="min-h-[40px] px-4 py-2 rounded-xl text-xs font-bold bg-[var(--kam-primary)] text-white"
              >
                حفظ الأسماء
              </button>
            </div>
          </div>
        </div>
      )}

      <ChildProfileModal
        student={selectedStudentForModal}
        onClose={() => setProfileStudentId(null)}
      />
    </div>
  );
};
