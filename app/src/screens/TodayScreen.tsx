import { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import { approveLead, formatDateTime, getLeads, getSchedule, type Lead, type ScheduleRow } from "../api";
import { Button, Card, ErrorBox, LevelBadge, Loading, StatusBadge, colors, s } from "../ui";

// "Việc hôm nay": khách chờ duyệt lịch và các lịch xem trong ngày
export default function TodayScreen({ onOpenLead }: { onOpenLead: (id: number) => void }) {
  const [pending, setPending] = useState<Lead[] | null>(null);
  const [today, setToday] = useState<ScheduleRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const [leads, schedule] = await Promise.all([getLeads(), getSchedule()]);
      setPending(leads.filter((l) => l.status === "NEW" && l.automationStatus !== "PENDING"));
      const day = (iso: string) => new Date(iso).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
      const todayText = day(new Date().toISOString());
      setToday(schedule.filter((r) => day(r.viewingTime) === todayText && (r.leadStatus === "NEW" || r.leadStatus === "CONFIRMED")));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi không xác định.");
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 20000);
    return () => clearInterval(timer);
  }, [load]);

  async function approve(id: number) {
    setBusyId(id);
    try {
      await approveLead(id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Duyệt thất bại.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <ScrollView
      contentContainerStyle={{ padding: 16 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
        />
      }
    >
      <ErrorBox message={error} />
      {pending === null && !error && <Loading />}

      <Text style={s.h2}>Chờ duyệt lịch ({pending?.length ?? 0})</Text>
      {pending?.length === 0 && <Text style={s.muted}>Không có khách nào đang chờ. 🎉</Text>}
      {pending?.map((l) => (
        <Card key={l.id} onPress={() => onOpenLead(l.id)}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={s.bold}>{l.name}</Text>
            <LevelBadge level={l.level} />
          </View>
          <Text style={[s.muted, { marginTop: 4 }]} numberOfLines={2}>
            {l.reason ?? l.needs ?? ""}
          </Text>
          <Button label={busyId === l.id ? "Đang duyệt..." : "Duyệt lịch xem"} tone="green" disabled={busyId !== null} onPress={() => approve(l.id)} style={{ marginTop: 10 }} />
        </Card>
      ))}

      <Text style={s.h2}>Lịch xem hôm nay ({today.length})</Text>
      {today.length === 0 && pending !== null && <Text style={s.muted}>Hôm nay không có lịch xem.</Text>}
      {today.map((r) => (
        <Card key={r.id} onPress={() => onOpenLead(r.leadId)}>
          <Text style={{ color: colors.blue, fontWeight: "700" }}>{formatDateTime(r.viewingTime)}</Text>
          <Text style={[s.bold, { marginTop: 2 }]}>{r.leadName}</Text>
          <Text style={s.muted}>{r.propertyName}</Text>
          <View style={{ marginTop: 6 }}>
            <StatusBadge status={r.leadStatus} />
          </View>
        </Card>
      ))}
    </ScrollView>
  );
}
