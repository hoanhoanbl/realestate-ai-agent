import { BadRequestException } from '@nestjs/common';

// Chuẩn hoá giờ xem nhà: không kèm múi giờ thì hiểu là giờ Việt Nam (+07:00), và bắt buộc ở tương lai.
export function parseViewingTime(raw: string): { text: string; date: Date } {
  let text = raw.trim();
  if (!text.endsWith('Z') && !/[+-]\d{2}:?\d{2}$/.test(text)) {
    text = `${text}+07:00`;
  }
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException('Invalid viewingTime format');
  }
  if (date.getTime() < Date.now()) {
    throw new BadRequestException('viewingTime phải ở trong tương lai');
  }
  return { text, date };
}
