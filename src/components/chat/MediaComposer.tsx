import React, { useEffect, useRef, useState } from 'react';
import { Image as ImageIcon, Mic, RotateCw, Send, Square, X } from 'lucide-react';
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

async function rotateDataUrl90(
  current: CompressedImageResult
): Promise<CompressedImageResult> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.height;
      canvas.height = img.width;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context unavailable'));
        return;
      }
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(Math.PI / 2);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      const base64Raw = dataUrl.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '');
      resolve({
        dataUrl,
        base64Raw,
        mimeType: 'image/jpeg',
        width: canvas.width,
        height: canvas.height,
        hash: current.hash,
      });
    };
    img.onerror = () => reject(new Error('تعذر تدوير الصورة'));
    img.src = current.dataUrl;
  });
}

export const MediaComposer: React.FC<MediaComposerProps> = ({ onSend, onError }) => {
  const [text, setText] = useState('');
  const [pendingImage, setPendingImage] = useState<CompressedImageResult | null>(null);
  const [imageCaption, setImageCaption] = useState('');
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
      setImageCaption(text);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'تعذر ضغط الصورة');
    }
  };

  const handleRotateImage = async () => {
    if (!pendingImage) return;
    try {
      const rotated = await rotateDataUrl90(pendingImage);
      setPendingImage(rotated);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'تعذر تدوير الصورة');
    }
  };

  const handleSendPendingImage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingImage || sending) return;
    setSending(true);
    try {
      await onSend({
        type: 'IMAGE',
        text: imageCaption.trim() || '📷 صورة',
        mediaBase64: pendingImage.base64Raw,
        mediaMimeType: pendingImage.mimeType,
        imageWidth: pendingImage.width,
        imageHeight: pendingImage.height,
      });
      setPendingImage(null);
      setImageCaption('');
      setText('');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'تعذر إرسال الصورة');
    } finally {
      setSending(false);
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
            text: `🎤 رسالة صوتية (${duration} ث)`,
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
    if (sending || !text.trim()) return;
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
    <div className="border-t border-[var(--kam-border)] bg-[var(--kam-surface)] p-2.5">
      {/* ChatImageEditPreviewDialog (Pre-Send Image Editor with 90° Rotate + Caption) */}
      {pendingImage && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <form
            onSubmit={handleSendPendingImage}
            className="w-full max-w-[400px] rounded-[22px] bg-[var(--kam-surface)] border border-[var(--kam-border)] p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold">معاينة وتعديل الصورة قبل الإرسال</h3>
              <button
                type="button"
                onClick={() => setPendingImage(null)}
                className="w-8 h-8 rounded-full bg-[var(--kam-surface-variant)] flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="relative rounded-2xl bg-black/40 border border-[var(--kam-border)] p-2 flex items-center justify-center max-h-72 overflow-hidden">
              <img
                src={pendingImage.dataUrl}
                alt="معاينة الصورة"
                className="max-h-64 rounded-xl object-contain"
              />
              <button
                type="button"
                onClick={handleRotateImage}
                className="absolute bottom-3 left-3 px-3 py-1.5 rounded-xl bg-black/75 text-white text-xs font-bold flex items-center gap-1.5 border border-white/20"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>تدوير 90°</span>
              </button>
            </div>

            <input
              type="text"
              value={imageCaption}
              onChange={(e) => setImageCaption(e.target.value)}
              placeholder="أضف تعليقاً تحت الصورة (اختياري)..."
              className="w-full h-11 px-3.5 rounded-xl bg-[var(--kam-bg)] border border-[var(--kam-border)] text-xs"
            />

            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={sending}
                className="flex-1 h-11 rounded-xl bg-[var(--kam-primary)] text-[var(--kam-on-primary)] font-bold text-xs flex items-center justify-center gap-1.5"
              >
                <Send className="w-4 h-4" />
                <span>{sending ? 'جاري الإرسال...' : 'إرسال الصورة'}</span>
              </button>
              <button
                type="button"
                onClick={() => setPendingImage(null)}
                className="px-4 h-11 rounded-xl bg-[var(--kam-surface-variant)] text-xs font-semibold"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={recording || sending}
          aria-label="إرفاق صورة"
          className="w-10 h-10 rounded-xl bg-[var(--kam-surface-variant)] border border-[var(--kam-border)] text-[var(--kam-text-secondary)] hover:text-[var(--kam-primary)] flex items-center justify-center shrink-0"
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
            className="h-10 px-3 rounded-xl bg-[var(--kam-danger)] text-white text-xs font-bold flex items-center gap-1.5 shrink-0 font-num"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
            <span>00:{String(recordSeconds).padStart(2, '0')} / 00:30</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={startRecording}
            disabled={sending}
            aria-label="تسجيل رسالة صوتية"
            className="w-10 h-10 rounded-xl bg-[var(--kam-surface-variant)] border border-[var(--kam-border)] text-[var(--kam-text-secondary)] hover:text-[var(--kam-primary)] flex items-center justify-center shrink-0 disabled:opacity-40"
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
          placeholder="اكتب رسالة للخدام..."
          className="flex-1 h-10 px-3.5 rounded-xl bg-[var(--kam-surface-variant)] border border-[var(--kam-border)] text-xs text-[var(--kam-text-primary)] placeholder:text-[var(--kam-text-muted)]"
        />

        <button
          type="submit"
          disabled={sending || recording || !text.trim()}
          aria-label="إرسال الرسالة"
          className="w-10 h-10 rounded-xl bg-[var(--kam-primary)] text-[var(--kam-on-primary)] flex items-center justify-center disabled:opacity-40 shrink-0"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
