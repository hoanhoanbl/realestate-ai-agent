import { signStaffLink, staffLinkRefusal, staffLinkUrl, verifyStaffLink } from './staff-link';

const secret = 'test-secret';

describe('Staff action link', () => {
  it('ký rồi đọc lại đúng viewing và hành động', () => {
    const token = signStaffLink({ viewingId: 12, action: 'approve' }, secret);
    expect(verifyStaffLink(token, secret)).toEqual({ viewingId: 12, action: 'approve' });
  });

  it('từ chối token bị sửa viewing, hành động hoặc chữ ký', () => {
    const [body, sig] = signStaffLink({ viewingId: 12, action: 'approve' }, secret).split('.');
    const forgedBody = Buffer.from(JSON.stringify({ v: 13, a: 'approve' })).toString('base64url');
    const forgedAction = Buffer.from(JSON.stringify({ v: 12, a: 'reschedule' })).toString('base64url');
    expect(verifyStaffLink(`${forgedBody}.${sig}`, secret)).toBeNull();
    expect(verifyStaffLink(`${forgedAction}.${sig}`, secret)).toBeNull();
    expect(verifyStaffLink(`${body}.${sig.slice(0, -2)}AA`, secret)).toBeNull();
    expect(verifyStaffLink(`${body}.`, secret)).toBeNull();
  });

  it('từ chối token ký bằng secret khác, thiếu secret hoặc rác', () => {
    const token = signStaffLink({ viewingId: 1, action: 'reschedule' }, 'other');
    expect(verifyStaffLink(token, secret)).toBeNull();
    expect(verifyStaffLink(token, undefined)).toBeNull();
    expect(() => signStaffLink({ viewingId: 1, action: 'approve' }, undefined)).toThrow();
    for (const junk of ['', 'a', 'a.b.c', '....', 'x'.repeat(400)]) expect(verifyStaffLink(junk, secret)).toBeNull();
  });

  it('link trỏ tới trang /duyet của web', () => {
    expect(staffLinkUrl('abc.def', 'https://nha.example/')).toBe('https://nha.example/duyet/abc.def');
  });
});

describe('Staff action link refusal', () => {
  const now = new Date('2026-11-12T03:00:00Z');
  const ok = {
    action: 'approve' as const,
    leadStatus: 'NEW',
    automationStatus: 'COMPLETED',
    viewingStatus: 'NEW',
    viewingTime: new Date('2026-11-14T03:00:00Z'),
    isOpenViewing: true,
    now,
  };

  it('cho thao tác khi lịch còn chờ duyệt, kể cả sau 48 giờ', () => {
    expect(staffLinkRefusal(ok)).toBeNull();
    expect(staffLinkRefusal({ ...ok, now: new Date('2026-11-14T02:59:00Z') })).toBeNull();
  });

  it.each([
    [{ viewingStatus: 'CANCELLED' }, /huỷ/],
    [{ viewingStatus: 'ATTENDED' }, /kết thúc/],
    [{ isOpenViewing: false }, /mới hơn/],
    [{ leadStatus: 'CONFIRMED' }, /đã được duyệt/],
    [{ leadStatus: 'LOST' }, /không còn ở trạng thái chờ/],
    [{ viewingTime: new Date('2026-11-12T03:00:00Z') }, /tới giờ hẹn/],
    [{ viewingTime: null }, /tới giờ hẹn/],
    [{ automationStatus: 'PENDING' }, /AI chưa chấm/],
  ])('từ chối %j', (change, message) => {
    expect(staffLinkRefusal({ ...ok, ...change })).toMatch(message);
  });

  it('chấm điểm chưa xong không chặn yêu cầu đổi giờ', () => {
    expect(staffLinkRefusal({ ...ok, action: 'reschedule', automationStatus: 'PENDING' })).toBeNull();
  });
});
