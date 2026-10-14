import { EventStatus } from '@prisma/client';

export type EventTimeWindow = {
  status: EventStatus;
  startAt: Date;
  endAt: Date;
};

/**
 * Trạng thái hiển thị của sự kiện luôn bám theo thời gian thực:
 *  - `DRAFT` giữ nguyên cho tới khi giáo viên công bố.
 *  - `now < startAt`        → `UPCOMING` (Sắp diễn ra).
 *  - `startAt ≤ now < endAt` → `LIVE` (Đang diễn ra).
 *  - `now ≥ endAt`          → `COMPLETED` (Đã kết thúc).
 *
 * Đây là nguồn duy nhất quyết định nhãn trạng thái, nên một sự kiện đã công bố
 * không bao giờ bị kẹt ở "Sắp diễn ra" khi đã đến giờ hoặc đã qua giờ.
 */
export function deriveEventStatus(
  event: EventTimeWindow,
  now: Date = new Date(),
): EventStatus {
  if (event.status === EventStatus.DRAFT) return EventStatus.DRAFT;
  if (now.getTime() >= event.endAt.getTime()) return EventStatus.COMPLETED;
  if (now.getTime() >= event.startAt.getTime()) return EventStatus.LIVE;
  return EventStatus.UPCOMING;
}

/** Sự kiện đã công bố và chưa kết thúc (dùng cho KPI và luồng học sinh). */
export function isEventOpenByTime(
  event: Pick<EventTimeWindow, 'startAt' | 'endAt'>,
  now: Date = new Date(),
): boolean {
  return now.getTime() < event.endAt.getTime();
}
