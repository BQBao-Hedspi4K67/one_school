export type EventStatus = 'DRAFT' | 'UPCOMING' | 'LIVE' | 'COMPLETED'

export type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral'

/**
 * Nhãn trạng thái sự kiện theo thời gian thực:
 *  - `UPCOMING` → Sắp diễn ra (chưa tới giờ bắt đầu)
 *  - `LIVE`     → Đang diễn ra (trong khoảng thời gian diễn ra)
 *  - `COMPLETED`→ Đã kết thúc (đã qua giờ kết thúc)
 */
export const eventStatusLabels: Record<EventStatus, string> = {
  DRAFT: 'Bản nháp',
  UPCOMING: 'Sắp diễn ra',
  LIVE: 'Đang diễn ra',
  COMPLETED: 'Đã kết thúc',
}

export const eventStatusVariants: Record<EventStatus, BadgeVariant> = {
  DRAFT: 'neutral',
  UPCOMING: 'info',
  LIVE: 'success',
  COMPLETED: 'warning',
}

/**
 * Suy ra trạng thái từ thời gian thực để nhãn luôn đúng ngay cả khi dữ liệu
 * cũ từ server chưa kịp đồng bộ (không còn trường hợp "Sắp diễn ra" vĩnh viễn).
 */
export function deriveEventStatus(
  event: { status: EventStatus; startAt: string; endAt: string },
  now: Date = new Date(),
): EventStatus {
  if (event.status === 'DRAFT') return 'DRAFT'
  const start = new Date(event.startAt).getTime()
  const end = new Date(event.endAt).getTime()
  const current = now.getTime()
  if (current >= end) return 'COMPLETED'
  if (current >= start) return 'LIVE'
  return 'UPCOMING'
}

/** Nhãn + biến thể màu của tag trạng thái theo thời gian. */
export function eventStatusBadge(
  event: { status: EventStatus; startAt: string; endAt: string },
  now?: Date,
): { label: string; variant: BadgeVariant } {
  const status = deriveEventStatus(event, now)
  return { label: eventStatusLabels[status], variant: eventStatusVariants[status] }
}
