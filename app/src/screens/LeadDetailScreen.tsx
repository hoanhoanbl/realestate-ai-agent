import { useCallback, useEffect, useState } from "react";
import { Alert, Linking, ScrollView, Text, TextInput, View } from "react-native";
import {
  approveLead,
  formatDateTime,
  formatVnd,
  getLead,
  getLeadEvents,
  parseVnDateTime,
  rescheduleViewing,
  setLeadStatus,
  type LeadDetail,
  type LeadEvent,
} from "../api";
import { Button, Card, ErrorBox, LevelBadge, Loading, StatusBadge, colors, s } from "../ui";

export default function LeadDetailScreen({ id, onBack }: { id: number; onBack: () => void }) {
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [events, setEvents] = useState<LeadEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [newTime, setNewTime] = useState("");
  const [editingTime, setEditingTime] = useState(false);

  const load = useCallback(async () => {
    try {
      const [l, ev] = await Promise.all([getLead(id), getLeadEvents(id)]);
      setLead(l);
      setEvents(ev);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi không xác định.");
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function run(action: () => Promise<string | void>) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const msg = await action();
      if (msg) setMessage(msg);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Thao tác thất bại.");
    } finally {
      setBusy(false);
    }
  }

  function confirm(title: string, onYes: () => void) {
    Alert.alert(title, undefined, [{ text: "Hủy", style: "cancel" }, { text: "Đồng ý", style: "destructive", onPress: onYes }]);
  }

  if (!lead) {
    return (
      <View style={{ padding: 16 }}>
        <Button label="← Quay lại" tone="ghost" onPress={onBack} />
        {error ? <ErrorBox message={error} /> : <Loading />}
      </View>
    );
  }

  const canApprove = lead.status === "NEW" && lead.automationStatus !== "PENDING";
  const canView = lead.status === "CONFIRMED";
  const canLose = lead.status !== "SIGNED" && lead.status !== "LOST";
  const canResched = (lead.status === "NEW" || lead.status === "CONFIRMED") && lead.viewing;

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <Button label="← Quay lại" tone="ghost" onPress={onBack} style={{ alignSelf: "flex-start" }} />
      <Text style={[s.title, { marginTop: 12 }]}>{lead.name}</Text>
      <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
        <StatusBadge status={lead.status} />
        <LevelBadge level={lead.level} />
      </View>

      <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
        <Button label="Gọi" style={{ flex: 1 }} onPress={() => Linking.openURL(`tel:${lead.phone}`)} />
        <Button label="Email" tone="ghost" style={{ flex: 1 }} onPress={() => Linking.openURL(`mailto:${lead.email}`)} />
      </View>

      <ErrorBox message={error} />
      {message && <Text style={{ color: colors.green, marginTop: 8 }}>{message}</Text>}

      <Text style={s.h2}>Việc cần làm</Text>
      <View style={{ gap: 10 }}>
        {canApprove && (
          <Button
            label="Duyệt lịch xem"
            tone="green"
            disabled={busy}
            onPress={() => run(async () => { await approveLead(lead.id); return "Đã duyệt. Email xác nhận được gửi cho khách."; })}
          />
        )}
        {canView && (
          <Button label="Đã xem nhà" disabled={busy} onPress={() => run(async () => { await setLeadStatus(lead.id, "VIEWED"); return "Đã đánh dấu đã xem nhà."; })} />
        )}
        {canResched && lead.viewing && !editingTime && (
          <Button
            label="Đổi giờ xem"
            tone="ghost"
            onPress={() => {
              setNewTime("");
              setEditingTime(true);
            }}
          />
        )}
        {editingTime && lead.viewing && (
          <Card>
            <Text style={s.muted}>Giờ mới (giờ Việt Nam), dạng 2026-10-25 14:30</Text>
            <TextInput
              value={newTime}
              onChangeText={setNewTime}
              placeholder="YYYY-MM-DD HH:mm"
              autoCapitalize="none"
              style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 10, marginVertical: 8, backgroundColor: "#fff" }}
            />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Button
                label="Lưu"
                style={{ flex: 1 }}
                disabled={busy}
                onPress={() => {
                  const iso = parseVnDateTime(newTime);
                  if (!iso) return setError("Sai định dạng. Ví dụ đúng: 2026-10-25 14:30");
                  run(async () => {
                    await rescheduleViewing(lead.viewing!.id, iso);
                    setEditingTime(false);
                    return "Đã đổi giờ xem.";
                  });
                }}
              />
              <Button label="Hủy" tone="ghost" style={{ flex: 1 }} onPress={() => setEditingTime(false)} />
            </View>
          </Card>
        )}
        {canLose && (
          <Button
            label="Mất khách"
            tone="danger"
            disabled={busy}
            onPress={() => confirm("Đánh dấu khách này không mua?", () => run(async () => { await setLeadStatus(lead.id, "LOST", "Mất khách"); return "Đã đánh dấu mất khách."; }))}
          />
        )}
        {!canApprove && !canView && !canLose && !canResched && <Text style={s.muted}>Không có việc nào cho khách này.</Text>}
      </View>

      <Text style={s.h2}>Thông tin</Text>
      <Card>
        <Text style={s.muted}>Điện thoại: <Text style={s.bold}>{lead.phone}</Text></Text>
        <Text style={s.muted}>Ngân sách: <Text style={s.bold}>{formatVnd(lead.budget)}</Text></Text>
        <Text style={s.muted}>Nhu cầu: <Text style={s.bold}>{lead.needs || "-"}</Text></Text>
        {lead.property && <Text style={s.muted}>Căn nhà: <Text style={s.bold}>{lead.property.name}</Text></Text>}
        {lead.viewing && <Text style={s.muted}>Giờ xem: <Text style={s.bold}>{formatDateTime(lead.viewing.viewingTime)}</Text></Text>}
        {lead.score !== null && <Text style={s.muted}>AI chấm: <Text style={s.bold}>{lead.score}/100 · {lead.reason}</Text></Text>}
      </Card>

      <Text style={s.h2}>Dòng thời gian</Text>
      {events.map((ev) => (
        <View key={ev.id} style={{ marginBottom: 10, paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: colors.border }}>
          <Text style={s.bold}>{ev.type}</Text>
          <Text style={s.muted}>{formatDateTime(ev.createdAt)}</Text>
          {ev.note && <Text style={{ color: colors.text, fontSize: 13 }}>{ev.note}</Text>}
        </View>
      ))}
    </ScrollView>
  );
}
