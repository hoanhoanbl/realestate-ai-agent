// Pure aggregation used by L4. No AI, no writes, no customer text in the output.
export interface ReportLead {
  id: number;
  status: string;
  assignedUserId: number | null;
  assignedAt: Date | null;
  responseDueAt: Date | null;
  firstResponseAt: Date | null;
}
export interface AssignmentEvent {
  id: number;
  leadId: number;
  type: string;
  note: string | null;
  createdAt: Date;
}
export interface ReportViewing {
  id: number;
  leadId: number;
  propertyId: number;
  viewingTime: Date | null;
  status: string;
}
export interface ReportFeedback {
  id: number;
  leadId: number;
  viewingId: number | null;
  submittedAt: Date;
  rating: number | null;
  interest: string | null;
  comment: string | null;
}
export interface ReportContract {
  id: number;
  leadId: number;
  propertyId: number;
  createdAt: Date;
  signedAt: Date | null;
}
export interface ReportUser {
  id: number;
  name: string;
  role: string;
}
export interface ReportProperty {
  id: number;
  name: string;
  status: string;
}
export interface BreakdownInput {
  leads: ReportLead[];
  assignments: AssignmentEvent[];
  viewings: ReportViewing[];
  feedbacks: ReportFeedback[];
  contracts: ReportContract[];
  users: ReportUser[];
  properties: ReportProperty[];
}
const OPEN = new Set(['CONSULTING', 'NEW', 'CONFIRMED', 'VIEWED', 'DEPOSIT']);
const REASONS: Record<string, RegExp> = {
  PRICE: /giá|gia cao|đắt|dat qua|ngân sách|ngan sach|chi phí|chi phi/,
  LOCATION: /vị trí|vi tri|khu vực|khu vuc|xa |đường|duong|di chuyển|di chuyen/,
  SPACE: /diện tích|dien tich|chật|chat|phòng|phong|nhỏ|nho/,
  CONDITION:
    /xuống cấp|xuong cap|ẩm|am moc|hư|hu hong|sửa chữa|sua chua|tình trạng|tinh trang/,
  LEGAL: /pháp lý|phap ly|sổ đỏ|so do|sổ hồng|so hong|giấy tờ|giay to/,
};
export function buildReportBreakdowns(
  input: BreakdownInput,
  from: Date,
  to: Date,
  asOf: Date,
) {
  const inPeriod = (date: Date | null) =>
    date !== null && date >= from && date < to && date <= asOf;
  const users = new Map(input.users.map((u) => [u.id, u]));
  const leads = new Map(input.leads.map((l) => [l.id, l]));
  const history = new Map<
    number,
    { at: Date; id: number | null; sequence: number }[]
  >();
  let unparsedAssignments = 0;
  for (const e of input.assignments) {
    // Compatibility with FE-33's immutable assignment notes. Never parse arbitrary customer notes.
    const pattern =
      e.type === 'LEAD_REASSIGNED'
        ? /^(?:\d+|chưa có) -> (\d+) \(/
        : /^(?:(?:\d+|chưa có) -> )?(\d+) \(/;
    const match = pattern.exec(e.note ?? '');
    const id =
      match && Number.isSafeInteger(Number(match[1])) ? Number(match[1]) : null;
    if (id === null) unparsedAssignments++;
    const rows = history.get(e.leadId) ?? [];
    rows.push({ at: e.createdAt, id, sequence: e.id });
    history.set(e.leadId, rows);
  }
  for (const l of input.leads) {
    const rows = history.get(l.id) ?? [];
    // The current assignment timestamp is authoritative, including same-owner reopening.
    if (l.assignedAt)
      rows.push({ at: l.assignedAt, id: l.assignedUserId, sequence: -1 });
    rows.sort(
      (a, b) => a.at.getTime() - b.at.getTime() || a.sequence - b.sequence,
    );
    history.set(l.id, rows);
  }
  const ownerAt = (leadId: number, date: Date) => {
    const rows = history.get(leadId) ?? [];
    let id: number | null = null;
    for (const row of rows) {
      if (row.at > date) break;
      id = row.id;
    }
    return id !== null && users.has(id) ? id : null;
  };
  const sales = new Map<
    number | null,
    {
      userId: number | null;
      name: string;
      role: string | null;
      assignedLeads: Set<number>;
      activeLeads: number;
      respondedOnTime: number;
      overdueUnanswered: number;
      viewedLeads: Set<number>;
      depositLeads: Set<number>;
      signedLeads: Set<number>;
    }
  >();
  const sale = (id: number | null) => {
    const user = id !== null ? users.get(id) : undefined;
    const key = user?.id ?? null;
    if (!sales.has(key))
      sales.set(key, {
        userId: key,
        name: user?.name ?? 'Chưa xác định người phụ trách',
        role: user?.role ?? null,
        assignedLeads: new Set(),
        activeLeads: 0,
        respondedOnTime: 0,
        overdueUnanswered: 0,
        viewedLeads: new Set(),
        depositLeads: new Set(),
        signedLeads: new Set(),
      });
    return sales.get(key)!;
  };
  for (const u of input.users) if (u.role === 'SALE') sale(u.id);
  for (const [leadId, rows] of history)
    for (const row of rows)
      if (inPeriod(row.at)) sale(row.id).assignedLeads.add(leadId);
  for (const l of input.leads) {
    const row = sale(l.assignedUserId);
    if (OPEN.has(l.status)) {
      row.activeLeads++;
      if (!l.firstResponseAt && l.responseDueAt && l.responseDueAt <= asOf)
        row.overdueUnanswered++;
    }
    // first_response_at is only retained for the CURRENT assignment. Never infer lost history.
    if (
      inPeriod(l.assignedAt) &&
      l.firstResponseAt &&
      l.firstResponseAt >= l.assignedAt! &&
      l.firstResponseAt <= asOf &&
      l.responseDueAt &&
      l.firstResponseAt <= l.responseDueAt
    )
      row.respondedOnTime++;
  }
  const properties = new Map(
    input.properties.map((p) => [
      p.id,
      {
        propertyId: p.id,
        name: p.name,
        status: p.status,
        scheduledViewings: 0,
        uniqueVisitors: new Set<number>(),
        attendedViewings: 0,
        attendedCustomers: new Set<number>(),
        cancelledViewings: 0,
        noShowViewings: 0,
        feedbackCount: 0,
        ratingTotal: 0,
        ratingCount: 0,
        interestedCustomers: new Set<number>(),
        depositContracts: new Set<number>(),
        signedContracts: new Set<number>(),
        reasons: {} as Record<string, number>,
      },
    ]),
  );
  const viewings = new Map(input.viewings.map((v) => [v.id, v]));
  for (const v of input.viewings)
    if (inPeriod(v.viewingTime)) {
      const p = properties.get(v.propertyId);
      if (p) {
        p.scheduledViewings++;
        p.uniqueVisitors.add(v.leadId);
        if (v.status === 'CANCELLED') p.cancelledViewings++;
        if (v.status === 'NO_SHOW') p.noShowViewings++;
        if (v.status === 'ATTENDED') {
          p.attendedViewings++;
          p.attendedCustomers.add(v.leadId);
        }
      }
      if (v.status === 'ATTENDED')
        sale(ownerAt(v.leadId, v.viewingTime!)).viewedLeads.add(v.leadId);
    }
  let unmappedFeedbacks = 0;
  for (const f of input.feedbacks)
    if (inPeriod(f.submittedAt)) {
      const v = f.viewingId === null ? undefined : viewings.get(f.viewingId);
      const p =
        v && v.leadId === f.leadId ? properties.get(v.propertyId) : undefined;
      if (!p) {
        unmappedFeedbacks++;
        continue;
      }
      p.feedbackCount++;
      if (f.rating !== null && f.rating >= 1 && f.rating <= 5) {
        p.ratingTotal += f.rating;
        p.ratingCount++;
      }
      if (f.interest === 'DEPOSIT') p.interestedCustomers.add(f.leadId);
      // Count mention themes only for customers choosing another property/no interest.
      if (['OTHER', 'NONE'].includes(f.interest ?? '') && f.comment?.trim()) {
        const comment = f.comment.toLocaleLowerCase('vi');
        const themes = Object.entries(REASONS)
          .filter(([, regex]) => regex.test(comment))
          .map(([key]) => key);
        for (const key of themes.length ? themes : ['OTHER'])
          p.reasons[key] = (p.reasons[key] ?? 0) + 1;
      }
    }
  for (const c of input.contracts) {
    if (inPeriod(c.createdAt)) {
      properties.get(c.propertyId)?.depositContracts.add(c.id);
      sale(ownerAt(c.leadId, c.createdAt)).depositLeads.add(c.leadId);
    }
    if (inPeriod(c.signedAt)) {
      properties.get(c.propertyId)?.signedContracts.add(c.id);
      sale(ownerAt(c.leadId, c.signedAt!)).signedLeads.add(c.leadId);
    }
  }
  const salesRows = [...sales.values()]
    .map((s) => ({
      ...s,
      assignedLeads: s.assignedLeads.size,
      viewedLeads: s.viewedLeads.size,
      depositLeads: s.depositLeads.size,
      signedLeads: s.signedLeads.size,
    }))
    .filter(
      (s) =>
        s.role === 'SALE' ||
        Object.entries(s).some(
          ([k, v]) =>
            !['userId', 'name', 'role'].includes(k) &&
            typeof v === 'number' &&
            v > 0,
        ),
    )
    .sort(
      (a, b) =>
        (a.role === 'SALE' ? 0 : 1) - (b.role === 'SALE' ? 0 : 1) ||
        a.name.localeCompare(b.name, 'vi'),
    );
  const propertyRows = [...properties.values()]
    .map((p) => {
      const { ratingTotal, ratingCount, ...rest } = p;
      return {
        ...rest,
        uniqueVisitors: p.uniqueVisitors.size,
        attendedCustomers: p.attendedCustomers.size,
        interestedCustomers: p.interestedCustomers.size,
        depositContracts: p.depositContracts.size,
        signedContracts: p.signedContracts.size,
        averageRating: ratingCount
          ? Math.round((ratingTotal / ratingCount) * 10) / 10
          : null,
      };
    })
    .sort(
      (a, b) =>
        b.scheduledViewings - a.scheduledViewings ||
        a.propertyId - b.propertyId,
    );
  return {
    version: 1,
    periodStart: from.toISOString(),
    periodEnd: to.toISOString(),
    asOf: asOf.toISOString(),
    responseScope: 'CURRENT_ASSIGNMENTS_IN_PERIOD' as const,
    sales: salesRows,
    properties: propertyRows,
    dataQuality: {
      unmappedFeedbacks,
      unparsedAssignments,
      leadCount: leads.size,
    },
  };
}

export type ReportBreakdowns = ReturnType<typeof buildReportBreakdowns>;
