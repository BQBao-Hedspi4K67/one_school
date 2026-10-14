import { EventStatus } from '@prisma/client';
import { deriveEventStatus, isEventOpenByTime } from './event-status';

const window = (startOffsetMinutes: number, endOffsetMinutes: number) => {
  const now = Date.now();
  return {
    status: EventStatus.UPCOMING,
    startAt: new Date(now + startOffsetMinutes * 60_000),
    endAt: new Date(now + endOffsetMinutes * 60_000),
  };
};

describe('deriveEventStatus (tag trạng thái bám theo thời gian thực)', () => {
  it('giữ nguyên DRAFT cho tới khi công bố', () => {
    expect(
      deriveEventStatus({ ...window(-60, 60), status: EventStatus.DRAFT }),
    ).toBe(EventStatus.DRAFT);
  });

  it('là UPCOMING khi chưa tới giờ bắt đầu', () => {
    expect(deriveEventStatus(window(60, 120))).toBe(EventStatus.UPCOMING);
  });

  it('là LIVE trong khoảng thời gian diễn ra', () => {
    expect(deriveEventStatus(window(-60, 60))).toBe(EventStatus.LIVE);
  });

  it('là LIVE đúng tại thời điểm bắt đầu', () => {
    expect(deriveEventStatus(window(0, 60))).toBe(EventStatus.LIVE);
  });

  it('là COMPLETED khi đã qua giờ kết thúc', () => {
    expect(deriveEventStatus(window(-120, -60))).toBe(EventStatus.COMPLETED);
  });

  it('là COMPLETED đúng tại thời điểm kết thúc', () => {
    expect(deriveEventStatus(window(-60, 0))).toBe(EventStatus.COMPLETED);
  });

  it('không coi sự kiện đã qua giờ kết thúc là đang mở', () => {
    expect(isEventOpenByTime(window(-120, -60))).toBe(false);
    expect(isEventOpenByTime(window(-60, 60))).toBe(true);
  });
});
