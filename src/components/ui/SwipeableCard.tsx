import React, { useRef, useState } from 'react';

interface SwipeableCardProps {
  children: React.ReactNode;
  disabled?: boolean;
  rightLabel: string;
  leftLabel: string;
  downLabel: string;
  onSwipeRight: () => void;
  onSwipeLeft: () => void;
  onSwipeDown: () => void;
}

const HORIZONTAL_THRESHOLD = 72;
const DOWN_THRESHOLD = 68;

export const SwipeableCard: React.FC<SwipeableCardProps> = ({
  children,
  disabled = false,
  rightLabel,
  leftLabel,
  downLabel,
  onSwipeRight,
  onSwipeLeft,
  onSwipeDown,
}) => {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const startRef = useRef<{ x: number; y: number; pointerId: number } | null>(null);

  const isInteractiveTarget = (target: EventTarget | null): boolean => {
    if (!(target instanceof HTMLElement)) return false;
    return Boolean(target.closest('button, input, textarea, select, a, label'));
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || isInteractiveTarget(e.target)) return;
    startRef.current = { x: e.clientX, y: e.clientY, pointerId: e.pointerId };
    setDragging(true);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore pointer capture failures
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!startRef.current || disabled) return;
    const dx = e.clientX - startRef.current.x;
    const dy = Math.max(-24, e.clientY - startRef.current.y);
    setOffset({ x: dx, y: dy });
  };

  const finishGesture = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!startRef.current) return;
    const dx = e.clientX - startRef.current.x;
    const dy = e.clientY - startRef.current.y;
    startRef.current = null;
    setDragging(false);
    setOffset({ x: 0, y: 0 });

    if (disabled) return;
    if (Math.abs(dx) >= HORIZONTAL_THRESHOLD && Math.abs(dx) >= Math.abs(dy)) {
      if (dx > 0) onSwipeRight();
      else onSwipeLeft();
    } else if (dy >= DOWN_THRESHOLD && dy > Math.abs(dx)) {
      onSwipeDown();
    }
  };

  const cancelGesture = () => {
    startRef.current = null;
    setDragging(false);
    setOffset({ x: 0, y: 0 });
  };

  const rightRatio = Math.min(1, Math.max(0, offset.x / HORIZONTAL_THRESHOLD));
  const leftRatio = Math.min(1, Math.max(0, -offset.x / HORIZONTAL_THRESHOLD));
  const downRatio =
    Math.abs(offset.x) < 48 ? Math.min(1, Math.max(0, offset.y / DOWN_THRESHOLD)) : 0;

  const activeIntent =
    rightRatio > 0.35
      ? { label: rightLabel, color: 'var(--kam-success)', opacity: rightRatio }
      : leftRatio > 0.35
      ? { label: leftLabel, color: 'var(--kam-danger)', opacity: leftRatio }
      : downRatio > 0.35
      ? { label: downLabel, color: 'var(--kam-warning)', opacity: downRatio }
      : null;

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishGesture}
      onPointerCancel={cancelGesture}
      style={{
        transform: `translate3d(${offset.x}px, ${offset.y * 0.65}px, 0) rotate(${offset.x * 0.04}deg)`,
        transition: dragging ? 'none' : 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1)',
        touchAction: 'none',
      }}
      className="relative select-none"
    >
      {activeIntent && (
        <div
          style={{
            opacity: activeIntent.opacity,
            borderColor: activeIntent.color,
            color: activeIntent.color,
          }}
          className="pointer-events-none absolute top-4 inset-x-4 z-20 flex justify-center"
        >
          <span
            style={{ borderColor: activeIntent.color }}
            className="px-4 py-1.5 rounded-xl border-2 bg-[var(--kam-surface)]/95 text-sm font-extrabold shadow-lg"
          >
            {activeIntent.label}
          </span>
        </div>
      )}
      {children}
    </div>
  );
};
