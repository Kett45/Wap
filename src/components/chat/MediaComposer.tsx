import React, { useEffect, useRef, useState } from 'react';
import { Image as ImageIcon, Mic, Send, Square, X } from 'lucide-react';
import {
  blobToBase64Raw,
  compressImageFile,
  MAX_CHAT_AUDIO_BASE64_CHARS,
  MAX_CHAT_IMAGE_BASE64_CHARS,
  type CompressedImageResult,
} from '../../lib/media';
import type { ChatMessageType } from '../../types/chat';

interface MediaComposerProps {
  onSend: (payload: {
    type: ChatMessageType;
    text: string;
    mediaBase64?: string;
    mediaMimeType?: string;
    imageWidth?: number;
    imageHeight?: number;
    audioDurationSec?: number;
  }) => Promise<void>;
  onError: (msg: string) => void;
}

export const MediaComposer: React.FC<MediaComposerProps> = ({ onSend, onError }) => {
  const [text, setText] = useState('');
  const [pendingImage, setPendingImage] = useState<CompressedImageResult | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [sending, setSending] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const recordSecRef = useRef(0);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.stop();
      }
    };
  }, []);

  const handleImagePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const compressed = await compressImageFile(file, {
        maxDim: 1440,
        maxChars: MAX_CHAT_IMAGE_BASE64_CHARS,
      });
      setPendingImage(compressed);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'تعذر ضغط الصورة');
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      const recorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 16000,
      });
      chunksRef.current = [];
      recordSecRef.current = 0;
      setRecordSeconds(0);

      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (timerRef.current) {
          window.clearInterval(timerRef.current);
          timerRef.current = null;
        }
        setRecording(false);
        const duration = Math.max(1, Math.min(30, recordSecRef.current));
        const blob = new Blob(chunksRef.current, { type: mimeType });
        try {
          const base64Raw = await blobToBase64Raw(blob);
          if (base64Raw.length > MAX_CHAT_AUDIO_BASE64_CHARS) {
            onError('الرسالة الصوتية أكبر من الحد المسموح (100KB). سجل رسالة أقصر.');
            return;
          }
          setSending(true);
          await onSend({
            type: 'AUDIO',
            text: `رسالة صوتية (${duration} ث)`,
            mediaBase64: base64Raw,
            mediaMimeType: mimeType,
            audioDurationSec: duration,
          });
        } catch (err) {
          onError(err instanceof Error ? err.message : 'تعذر إرسال الرسالة الصوتية');
        } finally {
          setSending(false);
        }
      };

      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      timerRef.current = window.setInterval(() => {
        recordSecRef.current += 1;
        setRecordSeconds(recordSecRef.current);
        if (recordSecRef.current >= 28) {
          recorder.stop();
        }
      }, 1000);
    } catch {
      onError('تعذر الوصول للميكروفون. تحقق من أذونات المتصفح.');
    }
  };

  const stopRecording = () => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending) return;

    if (pendingImage) {
      setSending(true);
      try {
        await onSend({
          type: 'IMAGE',
          text: text.trim() || 'صورة',
          mediaBase64: pendingImage.base64Raw,
          mediaMimeType: pendingImage.mimeType,
          imageWidth: pendingImage.width,
          imageHeight: pendingImage.height,
        });
        setPendingImage(null);
        setText('');
      } catch (err) {
        onError(err instanceof Error ? err.message : 'تعذر إرسال الصورة');
      } finally {
        setSending(false);
      }
      return;
    }

    if (!text.trim()) return;
    setSending(true);
    try {
      await onSend({
        type: 'TEXT',
        text: text.trim().slice(0, 1000),
      });
      setText('');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'تعذر إرسال الرسالة');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="border-t border-[var(--kam-border)] bg-[var(--kam-surface)] p-3 space-y-2">
      {pendingImage && (
        <div className="flex items-center gap-3 p-2 rounded-xl bg-[var(--kam-surface-variant)] border border-[var(--kam-border)]">
          <img
            src={pendingImage.dataUrl}
            alt="معاينة الصورة"
            className="w-14 h-14 rounded-lg object-cover border border-[var(--kam-border)]"
          />
          <div className="flex-1 min-w-0 text-xs">
            <div className="font-semibold">صورة جاهزة للإرسال</div>
            <div className="text-[var(--kam-text-muted)] font-num">
              {pendingImage.width}×{pendingImage.height} · {Math.round(pendingImage.base64Raw.length / 1024)}KB
            </div>
          </div>
          <button
            type="button"
            onClick={() => setPendingImage(null)}
            aria-label="إزالة الصورة"
            className="p-1.5 rounded-lg text-[var(--kam-text-muted)] hover:text-[var(--kam-danger)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={recording || sending}
          aria-label="إرفاق صورة"
          className="p-2.5 rounded-xl bg-[var(--kam-surface-variant)] border border-[var(--kam-border)] text-[var(--kam-text-secondary)] hover:text-[var(--kam-primary)] transition-colors shrink-0"
        >
          <ImageIcon className="w-4 h-4" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImagePick}
          className="hidden"
        />

        {recording ? (
          <button
            type="button"
            onClick={stopRecording}
            aria-label="إيقاف وإرسال التسجيل الصوتي"
            className="px-3 py-2.5 rounded-xl bg-[var(--kam-danger)] text-white text-xs font-bold flex items-center gap-1.5 shrink-0 font-num"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
            <span>00:{String(recordSeconds).padStart(2, '0')} / 00:30</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={startRecording}
            disabled={sending || Boolean(pendingImage)}
            aria-label="تسجيل رسالة صوتية"
            className="p-2.5 rounded-xl bg-[var(--kam-surface-variant)] border border-[var(--kam-border)] text-[var(--kam-text-secondary)] hover:text-[var(--kam-primary)] transition-colors shrink-0 disabled:opacity-40"
          >
            <Mic className="w-4 h-4" />
          </button>
        )}

        <input
          type="text"
          maxLength={1000}
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={recording}
          placeholder={pendingImage ? 'أضف تعليقاً للصورة (اختياري)...' : 'اكتب رسالة...'}
          className="flex-1 px-3.5 py-2.5 rounded-xl bg-[var(--kam-surface-variant)] border border-[var(--kam-border)] text-sm text-[var(--kam-text-primary)] placeholder:text-[var(--kam-text-muted)]"
        />

        <button
          type="submit"
          disabled={sending || recording || (!text.trim() && !pendingImage)}
          aria-label="إرسال الرسالة"
          className="px-4 py-2.5 rounded-xl bg-[var(--kam-primary)] text-[var(--kam-on-primary)] text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40 shrink-0"
        >
          <Send className="w-4 h-4" />
          <span className="hidden sm:inline">إرسال</span>
        </button>
      </form>
    </div>
  );
};
