// FE-24: máy chủ HTTP giả của backend, chỉ để kiểm runner đo chấm điểm AI mà không cần backend, n8n hay Gemini.
// Cài đúng luật đặt lịch thật (backend/src/viewings/viewing-time.ts và booking-rules.ts):
//   giờ tròn trong 08:00 đến 19:00 (giờ Việt Nam), sớm nhất sau 3 giờ làm việc, không quá 14 ngày,
//   hai lịch cùng căn cách nhau từ 60 phút (trùng thì 409), một email hay một số điện thoại một lịch đang chờ,
//   giới hạn 5 lần đặt mỗi 10 phút mỗi IP trừ khi gửi đúng X-Webhook-Secret (429).
// Chỉ nghe trên 127.0.0.1, cổng ngẫu nhiên. Đồng hồ của stub cố định (tuỳ chọn `now`) để kiểm tra lặp lại được.
const http = require('node:http');

const HOUR_MS = 3600000;
const VN_OFFSET_MS = 7 * HOUR_MS;
const FIRST_HOUR = 8;
const LAST_HOUR = 19;
const LEAD_HOURS = 3;
const MAX_DAYS = 14;
const GAP_MS = 60 * 60000;
const THROTTLE_LIMIT = 5;
const THROTTLE_WINDOW_MS = 10 * 60000;

const toVn = (d) => new Date(d.getTime() + VN_OFFSET_MS);
const fromVn = (d) => new Date(d.getTime() - VN_OFFSET_MS);
const pad = (n) => String(n).padStart(2, '0');
const dateKey = (d) => { const v = toVn(d); return `${v.getUTCFullYear()}-${pad(v.getUTCMonth() + 1)}-${pad(v.getUTCDate())}`; };
const timeKey = (d) => { const v = toVn(d); return `${pad(v.getUTCHours())}:${pad(v.getUTCMinutes())}`; };

// Cộng giờ làm việc 08:00 đến 21:00 theo giờ Việt Nam (khớp addWorkingHours của backend)
function addWorkingHours(from, hours) {
  const local = toVn(from);
  let remaining = hours * HOUR_MS;
  while (remaining > 0) {
    const start = new Date(local); start.setUTCHours(8, 0, 0, 0);
    const end = new Date(local); end.setUTCHours(21, 0, 0, 0);
    if (local < start) local.setTime(start.getTime());
    if (local >= end) { local.setUTCDate(local.getUTCDate() + 1); local.setUTCHours(8, 0, 0, 0); continue; }
    const used = Math.min(remaining, end.getTime() - local.getTime());
    local.setTime(local.getTime() + used);
    remaining -= used;
  }
  return fromVn(local);
}

function earliestBookableSlot(now) {
  const v = toVn(addWorkingHours(now, LEAD_HOURS));
  if (v.getUTCMinutes() || v.getUTCSeconds() || v.getUTCMilliseconds()) v.setUTCHours(v.getUTCHours() + 1, 0, 0, 0);
  if (v.getUTCHours() > LAST_HOUR) { v.setUTCDate(v.getUTCDate() + 1); v.setUTCHours(FIRST_HOUR, 0, 0, 0); }
  else if (v.getUTCHours() < FIRST_HOUR) v.setUTCHours(FIRST_HOUR, 0, 0, 0);
  return fromVn(v);
}

const latestBookableTime = (now) => new Date(now.getTime() + MAX_DAYS * 24 * HOUR_MS);

function bookableSlots(now) {
  const latest = latestBookableTime(now);
  const slots = [];
  const v = toVn(earliestBookableSlot(now));
  while (fromVn(v) <= latest) {
    if (v.getUTCHours() > LAST_HOUR) { v.setUTCDate(v.getUTCDate() + 1); v.setUTCHours(FIRST_HOUR, 0, 0, 0); continue; }
    slots.push(fromVn(v));
    v.setUTCHours(v.getUTCHours() + 1);
  }
  return slots;
}

// Trả về thông báo lỗi 400 hoặc null nếu giờ hợp lệ (khớp assertCustomerSlot)
function slotError(date, now) {
  const v = toVn(date);
  if (v.getUTCHours() < FIRST_HOUR || v.getUTCHours() > LAST_HOUR) return 'Giờ xem nhà phải trong khoảng 08:00–19:00';
  if (v.getUTCMinutes() || v.getUTCSeconds() || v.getUTCMilliseconds()) return 'Giờ xem nhà phải tròn giờ (ví dụ 09:00, 10:00)';
  if (date < earliestBookableSlot(now)) return 'Cần đặt trước ít nhất 3 giờ làm việc';
  if (date > latestBookableTime(now)) return 'Chỉ nhận đặt lịch trong vòng 14 ngày tới';
  return null;
}

const normalizePhone = (p) => String(p).replace(/[\s.()-]/g, '').replace(/^\+84/, '0');

// options:
//   now: () => Date              đồng hồ của stub (mặc định giờ thật)
//   user, password, secret       thông tin đăng nhập và X-Webhook-Secret hợp lệ
//   properties: [{ id, name, address, area, price, status }]
//   freeSlots: số khung còn trống của căn đầu tiên (đặt sẵn lịch vào phần còn lại); mặc định không đặt sẵn
//   scoreDelayMs                 độ trễ giả trước khi lead có điểm
//   scorer(lead) -> { level, score, reason } | { failed: true } | null (null: không bao giờ có điểm)
async function startBookingStub(options = {}) {
  const now = options.now ?? (() => new Date());
  const user = options.user ?? 'eval@local.test';
  const password = options.password ?? 'eval-pass';
  const secret = options.secret ?? 'stub-secret';
  const token = 'stub-token';
  const scoreDelayMs = options.scoreDelayMs ?? 50;
  const scorer = options.scorer ?? (() => ({ level: 'WARM', score: 55, reason: 'stub' }));
  const properties = options.properties ?? [
    { id: 1, name: 'Căn mẫu A', address: '1 Đường Mẫu, Đà Nẵng', area: 80, price: 3000000000, status: 'AVAILABLE' },
  ];

  const bookings = []; // lịch đang chờ: { leadId, propertyId, time, email, phone }
  const leads = new Map();
  const created = []; // mọi lead tạo được qua POST /api/viewings
  const stats = { postAttempts: 0, slotRequests: 0, loginRequests: 0, rejected: { 400: 0, 409: 0, 429: 0 } };
  const throttle = new Map(); // ip -> [thời điểm]
  const timers = new Set();
  let nextLeadId = 1000;

  if (options.freeSlots !== undefined) {
    const slots = bookableSlots(now());
    for (const time of slots.slice(0, Math.max(0, slots.length - options.freeSlots))) {
      bookings.push({ leadId: null, propertyId: properties[0].id, time, email: null, phone: null });
    }
  }

  const send = (res, status, body) => {
    const text = body === undefined ? '' : JSON.stringify(body);
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(text);
  };
  const reject = (res, status, message) => { stats.rejected[status] = (stats.rejected[status] ?? 0) + 1; send(res, status, { statusCode: status, message }); };
  const readBody = (req) => new Promise((resolve) => {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { resolve(null); } });
  });

  function slotsFor(propertyId) {
    const current = now();
    const days = [];
    for (const slot of bookableSlots(current)) {
      const key = dateKey(slot);
      if (days.length === 0 || days[days.length - 1].date !== key) days.push({ date: key, slots: [] });
      days[days.length - 1].slots.push({
        time: timeKey(slot),
        start: slot.toISOString(),
        available: !bookings.some((b) => b.propertyId === propertyId && Math.abs(b.time.getTime() - slot.getTime()) < GAP_MS),
      });
    }
    return { earliest: earliestBookableSlot(current).toISOString(), latest: latestBookableTime(current).toISOString(), days };
  }

  async function handle(req, res) {
    const url = new URL(req.url, 'http://stub');
    const route = `${req.method} ${url.pathname}`;

    if (route === 'POST /api/auth/login') {
      stats.loginRequests += 1;
      const body = await readBody(req);
      if (!body || body.email !== user || body.password !== password) return reject(res, 401, 'Sai email hoặc mật khẩu');
      return send(res, 200, { accessToken: token, user: { id: 1, email: user, role: 'ADMIN' } });
    }

    if (route === 'GET /api/properties') return send(res, 200, properties);

    if (route === 'GET /api/viewings/slots') {
      stats.slotRequests += 1;
      const propertyId = Number(url.searchParams.get('propertyId'));
      const property = properties.find((p) => p.id === propertyId);
      if (!property) return reject(res, 404, `Property with id ${propertyId} not found`);
      if (property.status !== 'AVAILABLE') return reject(res, 400, 'Căn nhà này hiện không nhận đặt lịch xem');
      return send(res, 200, slotsFor(propertyId));
    }

    if (route === 'POST /api/viewings') {
      stats.postAttempts += 1;
      const ip = req.socket.remoteAddress ?? 'unknown';
      if (req.headers['x-webhook-secret'] !== secret) {
        const recent = (throttle.get(ip) ?? []).filter((t) => Date.now() - t < THROTTLE_WINDOW_MS);
        if (recent.length >= THROTTLE_LIMIT) { throttle.set(ip, recent); return reject(res, 429, 'Quá nhiều yêu cầu, vui lòng thử lại sau'); }
        recent.push(Date.now());
        throttle.set(ip, recent);
      }
      const body = await readBody(req);
      if (!body) return reject(res, 400, 'Body không phải JSON');
      const { name, email, phone, budget, needs, propertyId, viewingTime, source } = body;
      if (typeof name !== 'string' || !name.trim()) return reject(res, 400, 'name không được trống');
      if (typeof email !== 'string' || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return reject(res, 400, 'email không hợp lệ');
      if (typeof phone !== 'string' || !/^[0-9+\s.-]{8,15}$/.test(phone.trim())) return reject(res, 400, 'phone không hợp lệ (8 đến 15 ký tự số)');
      if (!Number.isInteger(budget) || budget < 0) return reject(res, 400, 'budget phải là số nguyên từ 0');
      if (needs !== undefined && typeof needs !== 'string') return reject(res, 400, 'needs phải là chuỗi');
      if (!Number.isInteger(propertyId) || propertyId < 1) return reject(res, 400, 'propertyId không hợp lệ');
      const time = new Date(typeof viewingTime === 'string' ? viewingTime : NaN);
      if (Number.isNaN(time.getTime())) return reject(res, 400, 'viewingTime không hợp lệ');

      const property = properties.find((p) => p.id === propertyId);
      if (!property) return reject(res, 404, `Property with id ${propertyId} not found`);
      if (property.status !== 'AVAILABLE') return reject(res, 400, 'Căn nhà này hiện không nhận đặt lịch xem');
      const err = slotError(time, now());
      if (err) return reject(res, 400, err);
      if (bookings.some((b) => b.propertyId === propertyId && Math.abs(b.time.getTime() - time.getTime()) < GAP_MS)) {
        return reject(res, 409, 'Khung giờ này đã có khách hẹn xem căn này. Vui lòng chọn giờ cách ít nhất 60 phút.');
      }
      if (bookings.some((b) => b.propertyId === propertyId && b.email && b.email.toLowerCase() === email.trim().toLowerCase())) {
        return reject(res, 409, 'Bạn đã có lịch xem căn này');
      }
      if (bookings.some((b) => b.phone && b.phone === normalizePhone(phone))) {
        return reject(res, 409, 'Bạn đang có lịch xem. Nếu cần đổi giờ, hãy dùng link trong email xác nhận.');
      }

      const leadId = nextLeadId++;
      const lead = { id: leadId, name: name.trim(), email: email.trim(), phone: phone.trim(), budget, needs: needs ?? '', source: source || 'direct', score: null, level: null, reason: null, automationStatus: 'PENDING' };
      leads.set(leadId, lead);
      bookings.push({ leadId, propertyId, time, email: lead.email, phone: normalizePhone(phone) });
      created.push({ ...lead, propertyId, viewingTime: time.toISOString(), secretSent: req.headers['x-webhook-secret'] === secret });

      const outcome = scorer(lead);
      if (outcome) {
        const timer = setTimeout(() => {
          timers.delete(timer);
          if (outcome.failed) lead.automationStatus = 'FAILED';
          else Object.assign(lead, { score: outcome.score, level: outcome.level, reason: outcome.reason ?? null, automationStatus: 'COMPLETED' });
        }, scoreDelayMs);
        timers.add(timer);
      }
      return send(res, 201, { viewing: { id: leadId, propertyId, viewingTime: time.toISOString(), status: 'NEW' }, lead: { id: leadId, name: lead.name, source: lead.source } });
    }

    const leadMatch = /^\/api\/leads\/(\d+)$/.exec(url.pathname);
    if (req.method === 'GET' && leadMatch) {
      if (req.headers.authorization !== `Bearer ${token}`) return reject(res, 401, 'Unauthorized');
      const lead = leads.get(Number(leadMatch[1]));
      if (!lead) return reject(res, 404, 'Lead not found');
      return send(res, 200, { ...lead });
    }

    return reject(res, 404, `Không có route ${route}`);
  }

  const server = http.createServer((req, res) => {
    handle(req, res).catch((e) => send(res, 500, { statusCode: 500, message: String(e) }));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();

  return {
    url: `http://127.0.0.1:${port}`,
    port,
    user,
    password,
    secret,
    stats,
    created,
    bookings,
    leads,
    freeSlotCount: () => slotsFor(properties[0].id).days.flatMap((d) => d.slots).filter((s) => s.available).length,
    close: () => new Promise((resolve) => {
      for (const t of timers) clearTimeout(t);
      server.closeAllConnections?.();
      server.close(() => resolve());
    }),
  };
}

module.exports = { startBookingStub, bookableSlots, earliestBookableSlot, latestBookableTime, addWorkingHours };
