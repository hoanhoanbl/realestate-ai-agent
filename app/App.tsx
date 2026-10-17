import * as SecureStore from "expo-secure-store";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useState } from "react";
import { Pressable, SafeAreaView, Text, View } from "react-native";
import { clearPushToken, setToken, setUnauthorizedHandler, type SessionUser } from "./src/api";
import { registerForPush } from "./src/push";
import LeadDetailScreen from "./src/screens/LeadDetailScreen";
import LeadsScreen from "./src/screens/LeadsScreen";
import LoginScreen from "./src/screens/LoginScreen";
import TodayScreen from "./src/screens/TodayScreen";
import { colors, s } from "./src/ui";

const SESSION_KEY = "re_session";
type Tab = "today" | "leads";

export default function App() {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<{ token: string; user: SessionUser } | null>(null);
  const [tab, setTab] = useState<Tab>("today");
  const [leadId, setLeadId] = useState<number | null>(null);
  const [pushNote, setPushNote] = useState<string | null>(null);

  const logout = useCallback(async () => {
    try {
      await clearPushToken();
    } catch {
      // không có mạng hoặc token đã hết hạn: bỏ qua
    }
    setToken(null);
    setSession(null);
    setLeadId(null);
    await SecureStore.deleteItemAsync(SESSION_KEY);
  }, []);

  // Khôi phục phiên đã lưu khi mở app
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setToken(null);
      setSession(null);
      SecureStore.deleteItemAsync(SESSION_KEY);
    });
    SecureStore.getItemAsync(SESSION_KEY)
      .then((raw) => {
        if (raw) {
          const saved = JSON.parse(raw) as { token: string; user: SessionUser };
          setToken(saved.token);
          setSession(saved);
        }
      })
      .finally(() => setReady(true));
  }, []);

  // Có phiên thì đăng ký nhận thông báo đẩy
  useEffect(() => {
    if (session) registerForPush().then(setPushNote);
  }, [session]);

  async function onLoggedIn(token: string, user: SessionUser) {
    setToken(token);
    const next = { token, user };
    setSession(next);
    await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(next));
  }

  if (!ready) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar style="dark" />
      {!session ? (
        <LoginScreen onLoggedIn={onLoggedIn} />
      ) : leadId !== null ? (
        <LeadDetailScreen id={leadId} onBack={() => setLeadId(null)} />
      ) : (
        <>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, paddingBottom: 4 }}>
            <View>
              <Text style={s.title}>{tab === "today" ? "Việc hôm nay" : "Khách hàng"}</Text>
              <Text style={s.muted}>{session.user.name}</Text>
            </View>
            <Pressable onPress={logout} accessibilityRole="button">
              <Text style={{ color: colors.blue, fontWeight: "600" }}>Đăng xuất</Text>
            </Pressable>
          </View>
          {pushNote && <Text style={[s.muted, { paddingHorizontal: 16 }]}>ℹ️ {pushNote}</Text>}
          <View style={{ flex: 1 }}>
            {tab === "today" ? <TodayScreen onOpenLead={setLeadId} /> : <LeadsScreen onOpenLead={setLeadId} />}
          </View>
          <View style={{ flexDirection: "row", borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: "#fff" }}>
            {(["today", "leads"] as Tab[]).map((t) => (
              <Pressable key={t} onPress={() => setTab(t)} style={{ flex: 1, padding: 14, alignItems: "center" }} accessibilityRole="tab">
                <Text style={{ fontWeight: "700", color: tab === t ? colors.blue : colors.muted }}>{t === "today" ? "Hôm nay" : "Khách"}</Text>
              </Pressable>
            ))}
          </View>
        </>
      )}
    </SafeAreaView>
  );
}
