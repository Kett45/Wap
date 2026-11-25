import React, { useState } from 'react';
import {
  Ban,
  Camera,
  Check,
  Copy,
  Edit3,
  Eye,
  EyeOff,
  KeyRound,
  MessageCircle,
  Phone,
  Plus,
  RefreshCw,
  Share2,
  Shield,
  Tag,
  Trash2,
  UserCheck,
  Users,
} from 'lucide-react';
import { useKam } from '../context/KamContext';
import { AvatarBadge } from '../components/ui/AvatarBadge';
import { isServantOnline } from '../lib/arabic';
import { BLOCK_COLOR_PRESETS } from '../lib/kamRules';
import { compressImageFile } from '../lib/media';
import { buildTelLink, buildWhatsAppLink } from '../lib/phone';

export const GroupManagePage: React.FC = () => {
  const {
    group,
    joinedGroups,
    userProfile,
    blocks,
    students,
    members,
    invitations,
    isAdmin,
    isPrimaryAdmin,
    getServantDisplayName,
    regenerateInviteToken,
    updatePolicies,
    updateProfile,
    saveOwnMemberProfile,
    setAssistantAdmin,
    banServant,
    unbanServant,
    createInvitation,
    deleteInvitation,
    createBlock,
    updateBlock,
    deleteBlock,
    createGroup,
    joinGroup,
    switchGroup,
    showToast,
  } = useKam();

  const [inviteeName, setInviteeName] = useState('');
  const [newBlockName, setNewBlockName] = useState('');
  const [newBlockServantId, setNewBlockServantId] = useState('');
  const [newBlockColor, setNewBlockColor] = useState<string>(BLOCK_COLOR_PRESETS[0].hex);

  const [editingGroupName, setEditingGroupName] = useState(group?.name ?? '');
  const [copied, setCopied] = useState(false);

  const [newClassMode, setNewClassMode] = useState<'NONE' | 'JOIN' | 'CREATE'>('NONE');
  const [extraClassInput, setExtraClassInput] = useState('');

  // Full inline block editing
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [editingBlockName, setEditingBlockName] = useState('');
  const [editingBlockServantId, setEditingBlockServantId] = useState('');
  const [editingBlockColor, setEditingBlockColor] = useState<string>(BLOCK_COLOR_PRESETS[0].hex);

  // Block deletion confirmation (move children vs delete children)
  const [deletingBlockId, setDeletingBlockId] = useState<string | null>(null);

  // Servant personal alias inline editing & confirm ban
  const [aliasEditUid, setAliasEditUid] = useState<string | null>(null);
  const [aliasDraft, setAliasDraft] = useState('');
  const [confirmBanUid, setConfirmBanUid] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);

  React.useEffect(() => {
    if (group?.name) setEditingGroupName(group.name);
  }, [group?.name]);

  if (!group) return null;

  const fullInviteCode = group.dailyInviteToken
    ? `${group.inviteCode}-${group.dailyInviteToken}`
    : group.inviteCode;

  const hiddenBlockIds = userProfile?.hiddenBlockIds ?? [];

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(fullInviteCode);
      setCopied(true);
      showToast('تم نسخ كود الدعوة اليومي', 'success');
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast(fullInviteCode, 'info');
    }
  };

  const handleShareCode = async () => {
    const shareText = `كود الانضمام لفصل "${group.name}" في تطبيق نجم الكارت:\n${fullInviteCode}\n(صالح لمدة 24 ساعة)`;
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: `دعوة لفصل ${group.name}`, text: shareText });
        return;
      } catch {
        // User cancelled or share unavailable — fall back to clipboard
      }
    }
    await handleCopyCode();
  };

  const handleGroupAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      const compressed = await compressImageFile(file, { maxDim: 512, maxChars: 140000 });
      await updatePolicies({ avatarBase64: compressed.base64Raw, avatarHash: compressed.hash });
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'تعذر رفع صورة الفصل', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleOwnAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      const compressed = await compressImageFile(file, { maxDim: 512, maxChars: 140000 });
      await saveOwnMemberProfile({
        avatarBase64: compressed.base64Raw,
        avatarHash: compressed.hash,
        hasAvatar: true,
      });
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'تعذر رفع صورتك الشخصية', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleCreateBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBlockName.trim()) return;
    setBusy(true);
    try {
      await createBlock({
        servantId: newBlockServantId,
        servantName: newBlockName.trim(),
        colorHex: newBlockColor,
      });
      setNewBlockName('');
      setNewBlockServantId('');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'تعذر إنشاء البلوك', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleToggleHideBlock = async (blockId: string) => {
    const next = hiddenBlockIds.includes(blockId)
      ? hiddenBlockIds.filter((id) => id !== blockId)
      : [...hiddenBlockIds, blockId];
    await updateProfile({ hiddenBlockIds: next });
  };

  const handleSaveServantAlias = async (targetUid: string) => {
    const current = { ...(userProfile?.servantAliases ?? {}) };
    const clean = aliasDraft.trim().slice(0, 60);
    if (clean) current[targetUid] = clean;
    else delete current[targetUid];
    await updateProfile({ servantAliases: current });
    setAliasEditUid(null);
    showToast(clean ? 'تم حفظ الاسم المستعار الشخصي' : 'تم إزالة الاسم المستعار', 'success');
  };

  const handleExtraClassSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!extraClassInput.trim()) return;
    setBusy(true);
    try {
      if (newClassMode === 'CREATE') {
        await createGroup(extraClassInput.trim());
      } else if (newClassMode === 'JOIN') {
        await joinGroup(extraClassInput.trim());
      }
      setExtraClassInput('');
      setNewClassMode('NONE');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'تعذر إتمام العملية', 'error');
    } finally {
      setBusy(false);
    }
  };

  const bannedEntries = group.bannedServantEntries ?? [];

  return (
    <div className="max-w-4xl mx-auto space-y-5 pb-20">
      {/* Header & Class Info */}
      <section className="rounded-2xl bg-[var(--kam-surface)] border border-[var(--kam-border)] p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="relative">
              <AvatarBadge
                directBase64={group.avatarBase64}
                name={group.name}
                size="lg"
                accentColor="#5E6AD2"
              />
              {isAdmin && (
                <label
                  aria-label="تغيير صورة الفصل"
                  className="absolute -bottom-1 -left-1 min-h-[28px] min-w-[28px] flex items-center justify-center rounded-full bg-[var(--kam-primary)] text-white cursor-pointer shadow"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleGroupAvatarUpload}
                    className="hidden"
                  />
                </label>
              )}
            </div>
            <div>
              <h1 className="text-lg font-extrabold">{group.name}</h1>
              <p className="text-xs text-[var(--kam-text-muted)]">
                أمين الفصل: {getServantDisplayName(group.adminId, group.adminName)} ·{' '}
                <span className="font-num">{group.memberUids.length}</span> خادم ·{' '}
                <span className="font-num">{students.length}</span> طفل
              </p>
            </div>
          </div>

          {isPrimaryAdmin && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (editingGroupName.trim() && editingGroupName.trim() !== group.name) {
                  await updatePolicies({ name: editingGroupName.trim() });
                }
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                maxLength={100}
                value={editingGroupName}
                onChange={(e) => setEditingGroupName(e.target.value)}
                aria-label="تعديل اسم الفصل"
                className="flex-1 sm:w-48 min-h-[40px] px-3 py-1.5 rounded-xl bg-[var(--kam-surface-variant)] border border-[var(--kam-border)] text-xs"
              />
              <button
                type="submit"
                className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-[var(--kam-primary)] text-white text-xs font-bold shrink-0"
              >
                حفظ الاسم
              </button>
            </form>
          )}
        </div>

        {/* Daily Invite Code — Strictly visible ONLY to Admins */}
        {isAdmin && (
          <div className="p-4 rounded-2xl bg-[var(--kam-surface-variant)]/70 border border-[var(--kam-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold text-[var(--kam-text-secondary)] flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-[var(--kam-primary)]" />
                <span>كود الدعوة اليومي (للمسؤولين فقط · صالح 24 ساعة)</span>
              </div>
              <div dir="ltr" className="mt-1 text-lg font-num font-extrabold tracking-widest text-right">
                {fullInviteCode}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleShareCode}
                className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[var(--kam-surface)] border border-[var(--kam-border)] text-xs font-bold flex items-center gap-1.5"
              >
                <Share2 className="w-3.5 h-3.5 text-[var(--kam-primary)]" />
                <span>مشاركة</span>
              </button>
              <button
                type="button"
                onClick={handleCopyCode}
                className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[var(--kam-surface)] border border-[var(--kam-border)] text-xs font-bold flex items-center gap-1.5"
              >
                {copied ? (
                  <Check className="w-3.5 h-3.5 text-[var(--kam-success)]" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                <span>{copied ? 'تم النسخ' : 'نسخ'}</span>
              </button>
              <button
                type="button"
                onClick={regenerateInviteToken}
                className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[var(--kam-primary)] text-white text-xs font-bold flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>تجديد</span>
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Blocks Management */}
      <section className="rounded-2xl bg-[var(--kam-surface)] border border-[var(--kam-border)] p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-extrabold">إدارة بلوكات الخدام ({blocks.length})</h2>
        </div>

        {isAdmin && (
          <form onSubmit={handleCreateBlock} className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
            <input
              type="text"
              required
              maxLength={80}
              value={newBlockName}
              onChange={(e) => setNewBlockName(e.target.value)}
              placeholder="اسم البلوك الجديد (مثال: مجموعة أ. كيرلس)"
              className="sm:col-span-5 min-h-[42px] px-3.5 py-2 rounded-xl bg-[var(--kam-surface-variant)] border border-[var(--kam-border)] text-xs"
            />
            <select
              value={newBlockServantId}
              onChange={(e) => setNewBlockServantId(e.target.value)}
              aria-label="الخادم المسؤول عن البلوك"
              className="sm:col-span-3 min-h-[42px] px-3 py-2 rounded-xl bg-[var(--kam-surface-variant)] border border-[var(--kam-border)] text-xs"
            >
              <option value="">بدون تعيين خادم</option>
              {members.map((m) => (
                <option key={m.uid} value={m.uid}>
                  {getServantDisplayName(m.uid, m.displayName)}
                </option>
              ))}
            </select>
            <div className="sm:col-span-2 flex items-center gap-1.5 justify-center py-1">
              {BLOCK_COLOR_PRESETS.map((preset) => (
                <button
                  key={preset.hex}
                  type="button"
                  title={preset.nameAr}
                  aria-label={`لون ${preset.nameAr}`}
                  onClick={() => setNewBlockColor(preset.hex)}
                  className={`w-6 h-6 rounded-full transition-transform ${
                    newBlockColor === preset.hex ? 'scale-115 ring-2 ring-white' : 'opacity-70'
                  }`}
                  style={{ backgroundColor: preset.hex }}
                />
              ))}
            </div>
            <button
              type="submit"
              disabled={busy}
              className="sm:col-span-2 min-h-[42px] px-3 py-2 rounded-xl bg-[var(--kam-primary)] text-white text-xs font-bold flex items-center justify-center gap-1"
            >
              <Plus className="w-4 h-4" />
              <span>إنشاء</span>
            </button>
          </form>
        )}

        <div className="divide-y divide-[var(--kam-border)] border border-[var(--kam-border)] rounded-xl">
          {blocks.length === 0 ? (
            <div className="p-6 text-center text-xs text-[var(--kam-text-muted)]">
              لا توجد بلوكات حالياً.
            </div>
          ) : (
            blocks.map((blk) => {
              const count = students.filter((s) => s.blockId === blk.id).length;
              const canEditOwn = blk.servantId === userProfile?.userId;
              const isEditingThis = editingBlockId === blk.id;
              const isDeletingThis = deletingBlockId === blk.id;
              const isHidden = hiddenBlockIds.includes(blk.id);
              const assignedMember = members.find((m) => m.uid === blk.servantId);

              return (
                <div key={blk.id} className="p-3.5 space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <span
                        className="w-3.5 h-3.5 rounded-full shrink-0"
                        style={{ backgroundColor: blk.colorHex }}
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold truncate">{blk.servantName}</span>
                          <span className="text-xs font-num text-[var(--kam-text-muted)] shrink-0">
                            ({count} طفل)
                          </span>
                        </div>
                        {assignedMember && (
                          <div className="text-[0.72rem] text-[var(--kam-text-muted)]">
                            المسؤول: {getServantDisplayName(assignedMember.uid, assignedMember.displayName)}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                      <button
                        type="button"
                        onClick={() => handleToggleHideBlock(blk.id)}
                        className="min-h-[38px] px-2.5 py-1.5 rounded-xl text-xs font-semibold border border-[var(--kam-border)] flex items-center gap-1 text-[var(--kam-text-secondary)]"
                      >
                        {isHidden ? <Eye className="w-3.5 h-3.5 text-[var(--kam-primary)]" /> : <EyeOff className="w-3.5 h-3.5" />}
                        <span>{isHidden ? 'إظهار' : 'إخفاء'}</span>
                      </button>

                      {(isAdmin || canEditOwn) && (
                        <button
                          type="button"
                          onClick={() => {
                            if (isEditingThis) {
                              setEditingBlockId(null);
                            } else {
                              setEditingBlockId(blk.id);
                              setEditingBlockName(blk.servantName);
                              setEditingBlockServantId(blk.servantId || '');
                              setEditingBlockColor(blk.colorHex || BLOCK_COLOR_PRESETS[0].hex);
                              setDeletingBlockId(null);
                            }
                          }}
                          className="min-h-[38px] px-2.5 py-1.5 rounded-xl text-xs font-semibold border border-[var(--kam-border)] hover:border-[var(--kam-primary)] flex items-center gap-1"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>تعديل</span>
                        </button>
                      )}

                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => {
                            setDeletingBlockId(isDeletingThis ? null : blk.id);
                            setEditingBlockId(null);
                          }}
                          className="min-h-[38px] px-2.5 py-1.5 rounded-xl text-xs font-semibold text-[var(--kam-danger)] border border-[var(--kam-danger)]/40 hover:bg-[var(--kam-danger)]/10 flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>حذف</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Full Inline Block Editor (Name + Servant + Color) */}
                  {isEditingThis && (
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (!editingBlockName.trim()) return;
                        await updateBlock(blk.id, {
                          servantName: editingBlockName.trim(),
                          ...(isAdmin
                            ? {
                                servantId: editingBlockServantId,
                                colorHex: editingBlockColor,
                              }
                            : {}),
                        });
                        setEditingBlockId(null);
                      }}
                      className="p-3 rounded-xl bg-[var(--kam-surface-variant)]/70 border border-[var(--kam-border)] space-y-2.5"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input
                          type="text"
                          maxLength={80}
                          required
                          aria-label="اسم البلوك"
                          value={editingBlockName}
                          onChange={(e) => setEditingBlockName(e.target.value)}
                          className="min-h-[40px] px-3 py-1.5 rounded-xl bg-[var(--kam-surface)] border border-[var(--kam-border)] text-xs"
                        />
                        {isAdmin && (
                          <select
                            aria-label="الخادم المسؤول"
                            value={editingBlockServantId}
                            onChange={(e) => setEditingBlockServantId(e.target.value)}
                            className="min-h-[40px] px-3 py-1.5 rounded-xl bg-[var(--kam-surface)] border border-[var(--kam-border)] text-xs"
                          >
                            <option value="">بدون تعيين خادم</option>
                            {members.map((m) => (
                              <option key={m.uid} value={m.uid}>
                                {getServantDisplayName(m.uid, m.displayName)}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                      {isAdmin && (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-[var(--kam-text-muted)]">اللون:</span>
                          {BLOCK_COLOR_PRESETS.map((preset) => (
                            <button
                              key={preset.hex}
                              type="button"
                              aria-label={`اختيار لون ${preset.nameAr}`}
                              onClick={() => setEditingBlockColor(preset.hex)}
                              className={`w-6 h-6 rounded-full transition-transform ${
                                editingBlockColor === preset.hex ? 'scale-115 ring-2 ring-white' : 'opacity-70'
                              }`}
                              style={{ backgroundColor: preset.hex }}
                            />
                          ))}
                        </div>
                      )}
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingBlockId(null)}
                          className="min-h-[38px] px-3 py-1.5 rounded-xl text-xs border border-[var(--kam-border)]"
                        >
                          إلغاء
                        </button>
                        <button
                          type="submit"
                          className="min-h-[38px] px-4 py-1.5 rounded-xl bg-[var(--kam-primary)] text-white text-xs font-bold"
                        >
                          حفظ التعديل
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Block Deletion Choice (Move children vs Delete children) */}
                  {isDeletingThis && (
                    <div className="p-3 rounded-xl bg-[var(--kam-danger)]/10 border border-[var(--kam-danger)]/35 space-y-2.5">
                      <p className="text-xs font-bold text-[var(--kam-text-primary)]">
                        كيف تريد التعامل مع الأطفال داخل بلوك «{blk.servantName}» ({count} طفل)؟
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={async () => {
                            await deleteBlock(blk.id, false);
                            setDeletingBlockId(null);
                          }}
                          className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-[var(--kam-surface)] border border-[var(--kam-border)] text-xs font-bold"
                        >
                          حذف البلوك ونقل الأطفال لـ «بدون بلوك»
                        </button>
                        {count > 0 && (
                          <button
                            type="button"
                            onClick={async () => {
                              await deleteBlock(blk.id, true);
                              setDeletingBlockId(null);
                            }}
                            className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-[var(--kam-danger)] text-white text-xs font-bold"
                          >
                            حذف البلوك مع حذف الأطفال
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setDeletingBlockId(null)}
                          className="min-h-[38px] px-3 py-1.5 rounded-xl text-xs text-[var(--kam-text-muted)]"
                        >
                          إلغاء
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* Servants Directory & Personal Aliases (Zero raw emails exposed) */}
      <section className="rounded-2xl bg-[var(--kam-surface)] border border-[var(--kam-border)] p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-extrabold flex items-center gap-2">
            <Users className="w-4 h-4 text-[var(--kam-primary)]" />
            <span>خدام الفصل ({members.length})</span>
          </h2>
          <span className="text-xs text-[var(--kam-text-muted)]">الأسماء المستعارة خاصة بك فقط</span>
        </div>

        <div className="divide-y divide-[var(--kam-border)] border border-[var(--kam-border)] rounded-xl">
          {members.map((m) => {
            const isMemberPrimary = m.uid === group.adminId;
            const isMemberAssistant = group.assistantAdminIds?.includes(m.uid) ?? false;
            const isMe = m.uid === userProfile?.userId;
            const online = isServantOnline(m.lastSeenAt);
            const primaryPhone = m.primaryPhone || m.phone || '';
            const secondaryPhone = m.secondaryPhone || '';
            const canShowPhones =
              Boolean(primaryPhone || secondaryPhone) && !m.phoneHidden && m.showPhone !== false;
            const myAlias = userProfile?.servantAliases?.[m.uid] || '';

            return (
              <div key={m.uid} className="p-3.5 space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative">
                      <AvatarBadge
                        directBase64={m.avatarBase64 || m.avatar}
                        name={m.displayName}
                        size="sm"
                        online={online}
                      />
                      {isMe && (
                        <label
                          aria-label="تغيير صورتي الشخصية"
                          className="absolute -bottom-1 -left-1 w-5 h-5 rounded-full bg-[var(--kam-primary)] text-white flex items-center justify-center cursor-pointer shadow"
                        >
                          <Camera className="w-2.5 h-2.5" />
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleOwnAvatarUpload}
                            className="hidden"
                          />
                        </label>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold truncate">
                          {getServantDisplayName(m.uid, m.displayName)}
                        </span>
                        <span className="text-xs font-semibold text-[var(--kam-primary)]">
                          {isMemberPrimary ? 'أمين الفصل' : isMemberAssistant ? 'مساعد أمين' : 'خادم'}
                        </span>
                        {isMe && (
                          <span className="text-[0.7rem] text-[var(--kam-text-muted)]">(أنت)</span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-[0.72rem] text-[var(--kam-text-muted)]">
                        <span>{online ? 'متصل الآن' : 'غير متصل'}</span>
                        {myAlias && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>الاسم الأصلي: {m.displayName}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                    {canShowPhones && primaryPhone && (
                      <>
                        <a
                          href={buildTelLink(primaryPhone)}
                          aria-label={`اتصال بـ ${m.displayName}`}
                          className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-xl bg-[var(--kam-surface-variant)] border border-[var(--kam-border)] text-[var(--kam-text-secondary)] hover:text-[var(--kam-primary)]"
                        >
                          <Phone className="w-3.5 h-3.5" />
                        </a>
                        <a
                          href={buildWhatsAppLink(primaryPhone)}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`واتساب ${m.displayName}`}
                          className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-xl bg-[var(--kam-surface-variant)] border border-[var(--kam-border)] text-[var(--kam-success)]"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                        </a>
                      </>
                    )}
                    {canShowPhones && secondaryPhone && (
                      <a
                        href={buildTelLink(secondaryPhone)}
                        aria-label={`اتصال بالرقم الثانوي لـ ${m.displayName}`}
                        className="min-h-[38px] px-2.5 rounded-xl bg-[var(--kam-surface-variant)] border border-[var(--kam-border)] text-[0.72rem] font-num font-semibold flex items-center gap-1 text-[var(--kam-text-secondary)]"
                      >
                        <Phone className="w-3 h-3" />
                        <span>رقم 2</span>
                      </a>
                    )}

                    {!isMe && (
                      <button
                        type="button"
                        onClick={() => {
                          if (aliasEditUid === m.uid) {
                            setAliasEditUid(null);
                          } else {
                            setAliasEditUid(m.uid);
                            setAliasDraft(myAlias);
                          }
                        }}
                        className="min-h-[38px] px-2.5 py-1.5 rounded-xl text-xs font-semibold border border-[var(--kam-border)] hover:border-[var(--kam-primary)] flex items-center gap-1"
                      >
                        <Tag className="w-3.5 h-3.5 text-[var(--kam-primary)]" />
                        <span>{myAlias ? 'تعديل اللقب' : 'اسم مستعار'}</span>
                      </button>
                    )}

                    {isPrimaryAdmin && !isMemberPrimary && (
                      <button
                        type="button"
                        onClick={() => setAssistantAdmin(m.uid, !isMemberAssistant)}
                        className="min-h-[38px] px-2.5 py-1.5 rounded-xl text-xs font-semibold border border-[var(--kam-border)] hover:border-[var(--kam-primary)] flex items-center gap-1"
                      >
                        <Shield className="w-3.5 h-3.5 text-[var(--kam-primary)]" />
                        <span>{isMemberAssistant ? 'إلغاء مساعد' : 'تعيين مساعد'}</span>
                      </button>
                    )}

                    {isAdmin && !isMemberPrimary && !isMe && (
                      confirmBanUid === m.uid ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={async () => {
                              await banServant(m.uid, m.displayName);
                              setConfirmBanUid(null);
                            }}
                            className="min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-bold bg-[var(--kam-danger)] text-white"
                          >
                            تأكيد الحظر
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmBanUid(null)}
                            className="min-h-[38px] px-2.5 py-1.5 rounded-xl text-xs border border-[var(--kam-border)]"
                          >
                            إلغاء
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmBanUid(m.uid)}
                          className="min-h-[38px] px-2.5 py-1.5 rounded-xl text-xs font-semibold text-[var(--kam-danger)] border border-[var(--kam-danger)]/40 hover:bg-[var(--kam-danger)]/10 flex items-center gap-1"
                        >
                          <Ban className="w-3.5 h-3.5" />
                          <span>حظر</span>
                        </button>
                      )
                    )}
                  </div>
                </div>

                {/* Inline Personal Alias Form */}
                {aliasEditUid === m.uid && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSaveServantAlias(m.uid);
                    }}
                    className="flex items-center gap-2 pt-1"
                  >
                    <input
                      type="text"
                      maxLength={60}
                      autoFocus
                      value={aliasDraft}
                      onChange={(e) => setAliasDraft(e.target.value)}
                      placeholder={`اسم مستعار لـ ${m.displayName} يظهر لك فقط...`}
                      className="flex-1 min-h-[40px] px-3 py-1.5 rounded-xl bg-[var(--kam-surface-variant)] border border-[var(--kam-primary)] text-xs"
                    />
                    <button
                      type="submit"
                      className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-[var(--kam-primary)] text-white text-xs font-bold"
                    >
                      حفظ
                    </button>
                    <button
                      type="button"
                      onClick={() => setAliasEditUid(null)}
                      className="min-h-[40px] px-3 py-1.5 rounded-xl text-xs border border-[var(--kam-border)]"
                    >
                      إلغاء
                    </button>
                  </form>
                )}
              </div>
            );
          })}
        </div>

        {/* Banned Servants */}
        {isAdmin && bannedEntries.length > 0 && (
          <div className="pt-2 space-y-2">
            <h3 className="text-xs font-bold text-[var(--kam-danger)]">
              قائمة المحظورين ({bannedEntries.length})
            </h3>
            <div className="divide-y divide-[var(--kam-border)] border border-[var(--kam-danger)]/30 rounded-xl">
              {bannedEntries.map((entry) => {
                const [uid, name] = entry.split('|');
                return (
                  <div key={entry} className="px-3.5 py-2.5 flex items-center justify-between text-xs">
                    <span className="font-semibold">{name || 'خادم محظور'}</span>
                    <button
                      type="button"
                      onClick={() => unbanServant(uid)}
                      className="min-h-[36px] px-3 py-1 rounded-xl font-semibold text-[var(--kam-success)] border border-[var(--kam-success)]/40 flex items-center gap-1"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>فك الحظر</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* Invitations (Admins Only) */}
      {isAdmin && (
        <section className="rounded-2xl bg-[var(--kam-surface)] border border-[var(--kam-border)] p-4 sm:p-5 space-y-3">
          <h2 className="text-sm font-extrabold">الدعوات المسجلة ({invitations.length})</h2>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!inviteeName.trim()) return;
              await createInvitation(inviteeName.trim());
              setInviteeName('');
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              maxLength={80}
              value={inviteeName}
              onChange={(e) => setInviteeName(e.target.value)}
              placeholder="اسم الخادم المدعو..."
              className="flex-1 min-h-[42px] px-3.5 py-2 rounded-xl bg-[var(--kam-surface-variant)] border border-[var(--kam-border)] text-xs"
            />
            <button
              type="submit"
              className="min-h-[42px] px-4 py-2 rounded-xl bg-[var(--kam-primary)] text-white text-xs font-bold shrink-0"
            >
              إضافة دعوة
            </button>
          </form>

          {invitations.length > 0 && (
            <div className="divide-y divide-[var(--kam-border)] border border-[var(--kam-border)] rounded-xl">
              {invitations.map((inv) => (
                <div key={inv.id} className="px-3.5 py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold">{inv.inviteeName}</span>
                    <span className="mr-2 text-[var(--kam-text-muted)]">
                      {inv.status === 'PENDING'
                        ? 'قيد الانتظار'
                        : inv.status === 'ACCEPTED'
                        ? 'تم القبول'
                        : 'مرفوضة'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteInvitation(inv.id)}
                    aria-label="حذف الدعوة"
                    className="min-h-[36px] min-w-[36px] flex items-center justify-center text-[var(--kam-text-muted)] hover:text-[var(--kam-danger)]"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Switch / Create / Join Additional Classes (no invite codes exposed to non-admins) */}
      <section className="rounded-2xl bg-[var(--kam-surface)] border border-[var(--kam-border)] p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-sm font-extrabold">فصولي ({joinedGroups.length})</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setNewClassMode(newClassMode === 'JOIN' ? 'NONE' : 'JOIN')}
              className="min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-semibold border border-[var(--kam-border)] hover:border-[var(--kam-primary)]"
            >
              الانضمام لفصل
            </button>
            <button
              type="button"
              onClick={() => setNewClassMode(newClassMode === 'CREATE' ? 'NONE' : 'CREATE')}
              className="min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-semibold bg-[var(--kam-primary)] text-white"
            >
              إنشاء فصل جديد
            </button>
          </div>
        </div>

        {newClassMode !== 'NONE' && (
          <form onSubmit={handleExtraClassSubmit} className="flex gap-2 pt-1">
            <input
              type="text"
              value={extraClassInput}
              onChange={(e) => setExtraClassInput(e.target.value)}
              placeholder={
                newClassMode === 'CREATE' ? 'اسم الفصل الجديد...' : 'أدخل كود الدعوة اليومي...'
              }
              className="flex-1 min-h-[42px] px-3.5 py-2 rounded-xl bg-[var(--kam-surface-variant)] border border-[var(--kam-border)] text-xs"
            />
            <button
              type="submit"
              disabled={busy}
              className="min-h-[42px] px-4 py-2 rounded-xl bg-[var(--kam-primary)] text-white text-xs font-bold shrink-0"
            >
              {newClassMode === 'CREATE' ? 'إنشاء' : 'انضمام'}
            </button>
          </form>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {joinedGroups.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => switchGroup(g.id)}
              className={`min-h-[54px] p-3 rounded-xl border text-right flex items-center justify-between transition-colors ${
                g.id === group.id
                  ? 'bg-[var(--kam-primary-container)]/60 border-[var(--kam-primary)]'
                  : 'bg-[var(--kam-surface-variant)]/40 border-[var(--kam-border)] hover:border-[var(--kam-border-strong)]'
              }`}
            >
              <div className="min-w-0">
                <div className="text-xs font-bold truncate">{g.name}</div>
                <div className="text-[0.72rem] font-num text-[var(--kam-text-muted)]">
                  {g.memberUids.length} خادم
                </div>
              </div>
              {g.id === group.id && (
                <span className="text-xs font-bold text-[var(--kam-primary)] shrink-0">نشط</span>
              )}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
};
