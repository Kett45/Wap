// PhoneNumberFormatHelper for Egyptian/International numbers + WhatsApp & Tel links

export function sanitizePhoneDigits(raw: string): string {
  const arabicFixed = raw.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
  return arabicFixed.replace(/[^\d+]/g, '');
}

export function formatInternationalPhone(raw: string): string {
  const cleaned = sanitizePhoneDigits(raw);
  if (!cleaned) return '';
  if (cleaned.startsWith('+')) return cleaned;
  if (cleaned.startsWith('00')) return `+${cleaned.slice(2)}`;
  // Egyptian mobile default: 01xxxxxxxxx -> +201xxxxxxxxx
  if (cleaned.startsWith('01') && cleaned.length === 11) {
    return `+2${cleaned}`;
  }
  if (cleaned.startsWith('20') && cleaned.length === 12) {
    return `+${cleaned}`;
  }
  return `+${cleaned}`;
}

export function buildWhatsAppLink(rawPhone: string, prefillText?: string): string {
  const intl = formatInternationalPhone(rawPhone);
  const digitsOnly = intl.replace(/[^\d]/g, '');
  if (!digitsOnly) return '';
  const base = `https://wa.me/${digitsOnly}`;
  if (prefillText) {
    return `${base}?text=${encodeURIComponent(prefillText)}`;
  }
  return base;
}

export function buildTelLink(rawPhone: string): string {
  const intl = formatInternationalPhone(rawPhone);
  return intl ? `tel:${intl}` : '';
}
