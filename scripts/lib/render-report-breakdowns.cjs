// Embedded verbatim into the n8n Code node by sync-report-breakdowns.cjs.
module.exports = function renderReportBreakdowns(data) {
  if (!data || data.version !== 1) throw new Error('Thiếu thống kê sale/căn nhà L4');
  const esc = x => String(x ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const n = x => Number.isFinite(Number(x)) ? Number(x) : 0;
  const table = (headers, rows) => '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr>'
    + headers.map(x => '<th style="padding:8px;border:1px solid #e2e8f0;text-align:left">'+esc(x)+'</th>').join('')
    + '</tr></thead><tbody>'+rows.map(row => '<tr>'+row.map(x => '<td style="padding:8px;border:1px solid #e2e8f0">'+esc(x)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
  const sales = table(['Sale','Được giao','Đang phụ trách','Đúng hạn*','Quá hạn','Đã xem','HĐ cọc','Đã ký'], data.sales.map(s => [s.name,n(s.assignedLeads),n(s.activeLeads),n(s.respondedOnTime),n(s.overdueUnanswered),n(s.viewedLeads),n(s.depositLeads),n(s.signedLeads)]));
  const properties = table(['Căn nhà','Buổi/khách','Khách đến','Huỷ/vắng','Điểm / phản hồi','Muốn cọc','HĐ cọc/ký'],data.properties.map(p => [p.name,n(p.scheduledViewings)+' / '+n(p.uniqueVisitors),n(p.attendedCustomers),n(p.cancelledViewings)+' / '+n(p.noShowViewings),(p.averageRating==null?'Chưa có':n(p.averageRating)+'/5')+' / '+n(p.feedbackCount),n(p.interestedCustomers),n(p.depositContracts)+' / '+n(p.signedContracts)]));
  const labels={PRICE:'Giá/ngân sách',LOCATION:'Vị trí',SPACE:'Diện tích/phòng',CONDITION:'Tình trạng nhà',LEGAL:'Pháp lý',OTHER:'Khác'};
  const reasons=data.properties.filter(p=>Object.keys(p.reasons||{}).length).map(p=>'<li>'+esc(p.name)+': '+Object.entries(p.reasons).map(([k,v])=>esc(labels[k]||k)+': '+n(v)).join(' · ')+'</li>').join('');
  return '<section style="margin:20px auto;max-width:960px;font-family:Arial,sans-serif;color:#334155"><h3>Hiệu suất sale</h3>'
    + '<p>Đang phụ trách và quá hạn: ảnh chụp lúc '+esc(data.asOf)+'. Được giao/đã xem/HĐ thuộc kỳ báo cáo; mỗi chỉ số đếm khách duy nhất theo người.</p>'
    + sales + '<p style="font-size:12px">* Đúng hạn chỉ tính phiên giao hiện tại bắt đầu trong kỳ. Không suy đoán lịch sử phản hồi của phiên đã chuyển. Không xếp hạng, không so sánh sale với kỳ trước.</p>'
    + '<h3>Hiệu quả từng căn nhà</h3><p>Lịch có giờ hẹn trong kỳ, trạng thái lúc lập báo cáo. Cảm nhận theo ngày gửi, hợp đồng theo ngày tạo/ký.</p>'
    + properties + (reasons?'<p>Chủ đề được nhắc khi chọn căn khác/không còn nhu cầu:</p><ul>'+reasons+'</ul>':'')
    + '<p style="font-size:12px">Chủ đề là từ khoá trong nhận xét, không phải kết luận nguyên nhân. Một phản hồi có thể nhắc nhiều chủ đề. Muốn cọc chưa phải hợp đồng; hợp đồng được tạo chưa đồng nghĩa đã nhận tiền.</p>'
    + '<p style="font-size:12px">Cần kiểm tra: '+n(data.dataQuality?.unmappedFeedbacks)+' phản hồi chưa gắn được căn; '+n(data.dataQuality?.unparsedAssignments)+' mốc giao chưa xác định người.</p></section>';
};
