import React, { useEffect, useState } from 'react';
import { useKam } from '../../context/KamContext';
import { getPrimaryAvatarSrc, normalizeBase64ImageSrc } from '../../lib/media';
import { extractInitials } from '../../lib/arabic';

interface AvatarBadgeProps {
  studentId?: string;
  hasAvatar?: boolean;
  directBase64?: string;
  name: string;
  initials?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  accentColor?: string;
  accentHex?: string;
  online?: boolean;
}

const SIZE_CLASSES: Record<NonNullable<AvatarBadgeProps['size']>, string> = {
  xs: 'w-7 h-7 text-[0.7rem]',
  sm: 'w-9 h-9 text-xs',
  md: 'w-11 h-11 text-sm',
  lg: 'w-14 h-14 text-base',
  xl: 'w-24 h-24 text-2xl',
};

export const AvatarBadge: React.FC<AvatarBadgeProps> = ({
  studentId,
  hasAvatar,
  directBase64,
  name,
  initials,
  size = 'sm',
  accentColor,
  accentHex,
  online,
}) => {
  const resolvedAccent = accentColor || accentHex;
  const { avatarCache, ensureStudentAvatarLoaded } = useKam();
  const [imgFailed, setImgFailed] = useState(false);

  const cachedPacked = studentId ? avatarCache[studentId] : undefined;

  useEffect(() => {
    if (studentId && hasAvatar && cachedPacked === undefined) {
      ensureStudentAvatarLoaded(studentId);
    }
  }, [studentId, hasAvatar, cachedPacked, ensureStudentAvatarLoaded]);

  const src = directBase64
    ? normalizeBase64ImageSrc(getPrimaryAvatarSrc(directBase64) || directBase64)
    : cachedPacked
    ? getPrimaryAvatarSrc(cachedPacked)
    : '';

  const labelInitials = (initials || extractInitials(name)).slice(0, 2);

  return (
    <div className={`relative shrink-0 ${SIZE_CLASSES[size]}`}>
      {src && !imgFailed ? (
        <img
          src={src}
          alt={name}
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          className="w-full h-full rounded-full object-cover border border-[var(--kam-border)]"
        />
      ) : (
        <div
          className="w-full h-full rounded-full flex items-center justify-center font-bold select-none border border-[var(--kam-border)]"
          style={{
            backgroundColor: resolvedAccent ? `${resolvedAccent}22` : 'var(--kam-primary-container)',
            color: resolvedAccent || 'var(--kam-primary)',
          }}
        >
          {labelInitials}
        </div>
      )}
      {online && (
        <span
          title="متصل الآن"
          aria-label="متصل الآن"
          className="absolute -bottom-0.5 -left-0.5 w-3 h-3 rounded-full bg-[var(--kam-success)] border-2 border-[var(--kam-surface)]"
        />
      )}
    </div>
  );
};
