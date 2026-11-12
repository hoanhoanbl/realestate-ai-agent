import {
  buildReportBreakdowns,
  type BreakdownInput,
} from './report-breakdowns';
import { ReportBreakdownsService } from './report-breakdowns.service';

const at = (value: string) => new Date(`2026-11-${value}+07:00`);
const from = at('02T00:00:00'),
  to = at('09T00:00:00'),
  now = at('12T10:00:00');
function fixture(): BreakdownInput {
  return {
    users: [
      { id: 1, name: 'Minh', role: 'SALE' },
      { id: 2, name: 'An', role: 'SALE' },
      { id: 3, name: 'Quản lý', role: 'MANAGER' },
    ],
    properties: [
      { id: 10, name: 'Căn A', status: 'AVAILABLE' },
      { id: 20, name: 'Căn B', status: 'SOLD' },
      { id: 30, name: 'Chưa có lượt', status: 'AVAILABLE' },
    ],
    leads: [
      {
        id: 100,
        status: 'VIEWED',
        assignedUserId: 2,
        assignedAt: at('06T09:00:00'),
        responseDueAt: at('06T11:00:00'),
        firstResponseAt: at('06T10:00:00'),
      },
    ],
    assignments: [
      {
        id: 1,
        leadId: 100,
        type: 'LEAD_ASSIGNED',
        note: '1 (Minh)',
        createdAt: at('02T09:00:00'),
      },
      {
        id: 2,
        leadId: 100,
        type: 'LEAD_REASSIGNED',
        note: '1 -> 2 (An): khách muốn đổi sale',
        createdAt: at('06T09:00:00'),
      },
    ],
    viewings: [
      {
        id: 1,
        leadId: 100,
        propertyId: 10,
        status: 'ATTENDED',
        viewingTime: at('03T09:00:00'),
      },
      {
        id: 2,
        leadId: 100,
        propertyId: 10,
        status: 'ATTENDED',
        viewingTime: at('04T09:00:00'),
      },
      {
        id: 3,
        leadId: 100,
        propertyId: 20,
        status: 'ATTENDED',
        viewingTime: at('07T09:00:00'),
      },
      { id: 4, leadId: 100, propertyId: 20, status: 'NEW', viewingTime: to },
    ],
    feedbacks: [
      {
        id: 1,
        leadId: 100,
        viewingId: 1,
        submittedAt: at('08T09:00:00'),
        rating: 2,
        interest: 'OTHER',
        comment: 'Giá cao nhưng vị trí tốt',
      },
      {
        id: 2,
        leadId: 100,
        viewingId: 3,
        submittedAt: at('08T10:00:00'),
        rating: 5,
        interest: 'DEPOSIT',
        comment: 'Hợp ý',
      },
    ],
    contracts: [
      {
        id: 1,
        leadId: 100,
        propertyId: 10,
        createdAt: at('05T09:00:00'),
        signedAt: null,
      },
      {
        id: 2,
        leadId: 100,
        propertyId: 20,
        createdAt: at('07T10:00:00'),
        signedAt: at('08T10:00:00'),
      },
    ],
  };
}
describe('L4: sale gọn và hiệu quả đúng căn', () => {
  it('attributes results at their own time; two viewings are one customer per sale', () => {
    const r = buildReportBreakdowns(fixture(), from, to, now);
    expect(r.sales.find((s) => s.userId === 1)).toMatchObject({
      assignedLeads: 1,
      activeLeads: 0,
      viewedLeads: 1,
      depositLeads: 1,
      signedLeads: 0,
    });
    expect(r.sales.find((s) => s.userId === 2)).toMatchObject({
      assignedLeads: 1,
      activeLeads: 1,
      respondedOnTime: 1,
      viewedLeads: 1,
      depositLeads: 1,
      signedLeads: 1,
    });
    expect(r.properties.find((p) => p.propertyId === 10)).toMatchObject({
      scheduledViewings: 2,
      uniqueVisitors: 1,
      attendedCustomers: 1,
      feedbackCount: 1,
      averageRating: 2,
      depositContracts: 1,
      signedContracts: 0,
      reasons: { PRICE: 1, LOCATION: 1 },
    });
    expect(r.properties.find((p) => p.propertyId === 20)).toMatchObject({
      scheduledViewings: 1,
      feedbackCount: 1,
      averageRating: 5,
      interestedCustomers: 1,
      signedContracts: 1,
    });
    expect(r.properties.find((p) => p.propertyId === 30)).toMatchObject({
      scheduledViewings: 0,
      feedbackCount: 0,
      averageRating: null,
    });
    expect(r.sales[0]).not.toHaveProperty('previous');
  });
  it('does not assign legacy outcomes backwards to the current owner', () => {
    const data = fixture();
    data.assignments = [];
    const r = buildReportBreakdowns(data, from, to, now);
    expect(r.sales.find((s) => s.userId === null)).toMatchObject({
      viewedLeads: 1,
      depositLeads: 1,
    });
    expect(r.sales.find((s) => s.userId === 2)?.depositLeads).toBe(1);
  });
  it('separates current overdue snapshot, closed customers and current-period responses', () => {
    const data = fixture();
    data.leads.push(
      { ...data.leads[0], id: 101, firstResponseAt: null },
      { ...data.leads[0], id: 102, status: 'LOST', firstResponseAt: null },
      { ...data.leads[0], id: 103, assignedAt: at('01T09:00:00') },
    );
    const r = buildReportBreakdowns(data, from, to, now);
    expect(r.sales.find((s) => s.userId === 2)).toMatchObject({
      respondedOnTime: 1,
      overdueUnanswered: 1,
      activeLeads: 3,
    });
  });
  it('keeps null ratings and invalid feedback mappings out of property averages', () => {
    const data = fixture();
    data.feedbacks.push(
      { ...data.feedbacks[0], id: 3, viewingId: null },
      { ...data.feedbacks[1], id: 4, leadId: 999 },
      { ...data.feedbacks[0], id: 5, rating: null, comment: null },
    );
    const r = buildReportBreakdowns(data, from, to, now);
    expect(r.dataQuality.unmappedFeedbacks).toBe(2);
    expect(r.properties[0]).toMatchObject({
      feedbackCount: 2,
      averageRating: 2,
    });
    expect(JSON.stringify(r)).not.toContain('Giá cao nhưng vị trí tốt');
  });
  it('uses half-open boundaries and does not silently parse malformed ownership history', () => {
    const data = fixture();
    data.assignments.push({
      id: 4,
      leadId: 200,
      type: 'LEAD_REASSIGNED',
      note: 'không rõ',
      createdAt: from,
    });
    data.viewings.push({
      id: 9,
      leadId: 200,
      propertyId: 10,
      viewingTime: from,
      status: 'NO_SHOW',
    });
    data.feedbacks.push({ ...data.feedbacks[0], id: 8, submittedAt: to });
    const r = buildReportBreakdowns(data, from, to, now);
    expect(r.dataQuality.unparsedAssignments).toBe(1);
    expect(r.properties[0]).toMatchObject({
      noShowViewings: 1,
      feedbackCount: 1,
    });
  });
  it('does not count corrupt response timestamps or comments without an OTHER/NONE decision', () => {
    const data = fixture();
    data.leads[0].firstResponseAt = at('05T09:00:00');
    data.feedbacks[0].interest = null;
    const r = buildReportBreakdowns(data, from, to, now);
    expect(r.sales.find((s) => s.userId === 2)?.respondedOnTime).toBe(0);
    expect(r.properties[0].reasons).toEqual({});
  });
  it('rejects invalid/reversed/oversized periods before querying the database', async () => {
    const transaction = jest.fn();
    const service = new ReportBreakdownsService({ transaction } as any);
    for (const [start, end] of [
      ['bad', 'bad'],
      [to.toISOString(), from.toISOString()],
      ['2025-01-01', '2026-11-01'],
    ]) {
      await expect(service.get(start, end)).rejects.toThrow('Kỳ báo cáo');
    }
    expect(transaction).not.toHaveBeenCalled();
  });
});
