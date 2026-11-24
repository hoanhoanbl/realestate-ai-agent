// FE-24: tính số liệu và dựng báo cáo cho phép đo chấm điểm AI. Thuần tính toán, không gọi mạng.
//
// Một kết quả (một lượt đo của một lead):
//   { caseId, label, run, status, level, score, reason, latencyS }
//   - label: mức kỳ vọng (HOT | WARM | COLD)
//   - status: 'SCORED' (AI chấm xong) | 'FAILED' (luồng báo lỗi) | 'TIMEOUT' (quá hạn chờ)
//   - level, score, reason: AI trả về (chỉ có khi SCORED)
//   - latencyS: giây từ lúc đặt lịch tới lúc có điểm
const LEVELS = ['HOT', 'WARM', 'COLD'];
const RANK = { HOT: 0, WARM: 1, COLD: 2 };

// Ngưỡng tham chiếu để đọc kết quả (design D5). Không phải điều kiện merge.
const TARGETS = { exactRate: 0.8, withinOneRate: 0.95, severe: 0, errorRate: 0.05 };

const isMeasured = (r) => r.status === 'SCORED' && LEVELS.includes(r.level) && LEVELS.includes(r.label);

// Trung vị. Rỗng thì null.
function median(values) {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

// Phân vị theo hạng gần nhất (nearest-rank): phần tử thứ ceil(p * n). Rỗng thì null.
function percentile(values, p) {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.max(1, Math.ceil(p * s.length)) - 1];
}

function computeMetrics(results) {
  const total = results.length;
  const measured = results.filter(isMeasured);
  const errors = results.filter((r) => !isMeasured(r));
  const failed = errors.filter((r) => r.status === 'FAILED').length;
  const timedOut = errors.filter((r) => r.status === 'TIMEOUT').length;

  const confusion = Object.fromEntries(LEVELS.map((e) => [e, Object.fromEntries(LEVELS.map((a) => [a, 0]))]));
  let exact = 0;
  let withinOne = 0;
  let severe = 0;
  const wrong = [];
  for (const r of measured) {
    confusion[r.label][r.level] += 1;
    const gap = Math.abs(RANK[r.label] - RANK[r.level]);
    if (gap === 0) exact += 1;
    else wrong.push({ caseId: r.caseId, run: r.run, label: r.label, level: r.level, score: r.score, reason: r.reason, gap });
    if (gap <= 1) withinOne += 1;
    if (gap === 2) severe += 1;
  }

  const latencies = measured.map((r) => r.latencyS).filter((x) => Number.isFinite(x));
  const n = measured.length;

  // Độ nhất quán: lead nào có từ hai lượt trở lên và mọi lượt đều đo được thì xét có cùng mức ở mọi lượt không.
  const byCase = new Map();
  for (const r of results) {
    if (!byCase.has(r.caseId)) byCase.set(r.caseId, []);
    byCase.get(r.caseId).push(r);
  }
  const repeated = [...byCase.values()].filter((runs) => runs.length > 1);
  let consistency = null;
  if (repeated.length > 0) {
    const complete = repeated.filter((runs) => runs.every(isMeasured));
    const consistent = complete.filter((runs) => runs.every((r) => r.level === runs[0].level));
    consistency = {
      cases: complete.length,
      consistent: consistent.length,
      rate: complete.length > 0 ? consistent.length / complete.length : null,
      excluded: repeated.length - complete.length,
      unstableCaseIds: complete.filter((runs) => !runs.every((r) => r.level === runs[0].level)).map((runs) => runs[0].caseId),
    };
  }

  return {
    total,
    measured: n,
    errors: errors.length,
    failed,
    timedOut,
    errorRate: total > 0 ? errors.length / total : null,
    exact,
    exactRate: n > 0 ? exact / n : null,
    withinOne,
    withinOneRate: n > 0 ? withinOne / n : null,
    severe,
    confusion,
    wrong,
    latency: { count: latencies.length, median: median(latencies), p95: percentile(latencies, 0.95) },
    consistency,
  };
}

// 0,833 -> "83,3%"; kiểu Việt Nam dùng dấu phẩy.
const pct = (x) => `${(Math.round(x * 1000) / 10).toFixed(1).replace('.', ',')}%`;
const frac = (count, den) => (den > 0 ? `${count}/${den} (${pct(count / den)})` : 'không có dữ liệu đo');
const sec = (x) => (x === null ? 'không có dữ liệu' : `${(Math.round(x * 10) / 10).toFixed(1).replace('.', ',')} s`);
const cell = (text) => String(text ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');

// Các mục chưa đạt ngưỡng tham chiếu; rỗng nghĩa là đạt hết (hoặc không có dữ liệu để so).
function missedTargets(m) {
  const out = [];
  if (m.exactRate !== null && m.exactRate < TARGETS.exactRate) out.push(`độ chính xác đúng mức ${pct(m.exactRate)} dưới mục tiêu ${pct(TARGETS.exactRate)}`);
  if (m.withinOneRate !== null && m.withinOneRate < TARGETS.withinOneRate) out.push(`độ chính xác chấp nhận lệch một bậc ${pct(m.withinOneRate)} dưới mục tiêu ${pct(TARGETS.withinOneRate)}`);
  if (m.severe > TARGETS.severe) out.push(`có ${m.severe} lỗi nghiêm trọng (HOT chấm COLD hoặc ngược lại), mục tiêu là ${TARGETS.severe}`);
  if (m.errorRate !== null && m.errorRate >= TARGETS.errorRate) out.push(`tỷ lệ lỗi hoặc quá hạn chờ ${pct(m.errorRate)}, mục tiêu dưới ${pct(TARGETS.errorRate)}`);
  return out;
}

// meta: { model, date, api, repeat, property } — mọi trường đều tuỳ chọn.
function renderReport(m, meta = {}) {
  const lines = [];
  lines.push('# Báo cáo đo chấm điểm AI (FE-24)', '');
  lines.push(`- Mô hình: ${meta.model ?? 'không rõ'}`);
  lines.push(`- Ngày chạy: ${meta.date ?? 'không rõ'}`);
  if (meta.api) lines.push(`- Backend: ${meta.api}`);
  if (meta.property) lines.push(`- Căn dùng để đo: ${meta.property}`);
  if (meta.repeat) lines.push(`- Số lần lặp: ${meta.repeat}`);
  lines.push(`- Số lượt đo: ${m.total}, đo được ${m.measured}, lỗi hoặc quá hạn chờ ${m.errors}`, '');

  if (m.measured === 0) {
    lines.push('## Kết quả', '', `Không có dữ liệu đo: cả ${m.total} lượt đều lỗi hoặc quá hạn chờ (${m.failed} lỗi, ${m.timedOut} quá hạn), nên không tính được độ chính xác.`, '');
    if (m.errorRate !== null) lines.push(`Tỷ lệ lỗi hoặc quá hạn chờ: ${frac(m.errors, m.total)}.`, '');
    return lines.join('\n');
  }

  lines.push('## Số đo', '');
  lines.push('| Chỉ số | Giá trị |', '| --- | --- |');
  lines.push(`| Đúng mức | ${frac(m.exact, m.measured)} |`);
  lines.push(`| Chấp nhận lệch một bậc | ${frac(m.withinOne, m.measured)} |`);
  lines.push(`| Lỗi nghiêm trọng (HOT↔COLD) | ${m.severe} |`);
  lines.push(`| Lỗi hoặc quá hạn chờ | ${frac(m.errors, m.total)} (${m.failed} lỗi, ${m.timedOut} quá hạn) |`);
  lines.push(`| Độ trễ trung vị | ${sec(m.latency.median)} |`);
  lines.push(`| Độ trễ p95 | ${sec(m.latency.p95)} |`);
  if (m.consistency) {
    const c = m.consistency;
    lines.push(`| Cùng mức ở mọi lần chạy | ${frac(c.consistent, c.cases)}${c.excluded > 0 ? `, bỏ ${c.excluded} lead có lượt lỗi` : ''} |`);
  }
  lines.push('');

  lines.push('## Ma trận nhầm lẫn', '', 'Hàng là mức kỳ vọng, cột là mức AI chấm.', '');
  lines.push('| Kỳ vọng \\ AI chấm | HOT | WARM | COLD |', '| --- | ---: | ---: | ---: |');
  for (const e of LEVELS) lines.push(`| ${e} | ${LEVELS.map((a) => m.confusion[e][a]).join(' | ')} |`);
  lines.push('');

  lines.push('## Lead chấm sai', '');
  if (m.wrong.length === 0) lines.push('Không có.', '');
  else {
    lines.push('| Lead | Lượt | Kỳ vọng | AI chấm | Điểm | Lý do AI trả về |', '| --- | ---: | --- | --- | ---: | --- |');
    for (const w of m.wrong) lines.push(`| ${cell(w.caseId)} | ${w.run ?? 1} | ${w.label} | ${w.level}${w.gap === 2 ? ' (nghiêm trọng)' : ''} | ${w.score ?? ''} | ${cell(w.reason)} |`);
    lines.push('');
  }
  if (m.consistency && m.consistency.unstableCaseIds.length > 0) {
    lines.push(`Lead chấm khác mức giữa các lần chạy: ${m.consistency.unstableCaseIds.join(', ')}.`, '');
  }

  const missed = missedTargets(m);
  lines.push('## So với mục tiêu', '');
  lines.push(`Mục tiêu tham chiếu: đúng mức từ ${pct(TARGETS.exactRate)}, lệch một bậc từ ${pct(TARGETS.withinOneRate)}, không có lỗi nghiêm trọng, tỷ lệ lỗi dưới ${pct(TARGETS.errorRate)}.`, '');
  if (missed.length === 0) lines.push('**Đạt** mọi mục tiêu tham chiếu.', '');
  else {
    lines.push('**Chưa đạt mục tiêu:**', '');
    for (const x of missed) lines.push(`- ${x}`);
    lines.push('');
  }
  lines.push(`Cỡ mẫu nhỏ (${m.measured} lượt đo được): một lượt sai làm độ chính xác đổi khoảng ${pct(1 / m.measured)}; không khẳng định ý nghĩa thống kê.`, '');
  return lines.join('\n');
}

module.exports = { computeMetrics, renderReport, median, percentile, missedTargets, TARGETS, LEVELS };
