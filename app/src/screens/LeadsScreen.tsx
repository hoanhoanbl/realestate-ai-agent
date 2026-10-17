import { useCallback, useEffect, useState } from "react";
import { FlatList, RefreshControl, Text, View } from "react-native";
import { formatVnd, getLeads, type Lead } from "../api";
import { Card, ErrorBox, LevelBadge, Loading, StatusBadge, s } from "../ui";

export default function LeadsScreen({ onOpenLead }: { onOpenLead: (id: number) => void }) {
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setLeads(await getLeads());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi không xác định.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (leads === null) return error ? <ErrorBox message={error} /> : <Loading />;

  return (
    <FlatList
      data={leads}
      keyExtractor={(l) => String(l.id)}
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
      ListHeaderComponent={<ErrorBox message={error} />}
      ListEmptyComponent={<Text style={s.muted}>Chưa có khách nào.</Text>}
      renderItem={({ item: l }) => (
        <Card onPress={() => onOpenLead(l.id)}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={s.bold}>{l.name}</Text>
            <LevelBadge level={l.level} />
          </View>
          <Text style={[s.muted, { marginTop: 2 }]}>
            {l.phone} · {formatVnd(l.budget)}
          </Text>
          <View style={{ marginTop: 6 }}>
            <StatusBadge status={l.status} />
          </View>
        </Card>
      )}
    />
  );
}
