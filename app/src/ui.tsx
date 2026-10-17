import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import type { LeadStatus, Level } from "./api";

export const colors = {
  bg: "#f8fafc",
  card: "#ffffff",
  border: "#e2e8f0",
  text: "#0f172a",
  muted: "#64748b",
  blue: "#2563eb",
  green: "#16a34a",
  red: "#dc2626",
  amber: "#d97706",
};

const LEVEL_COLOR: Record<Level, string> = { HOT: "#dc2626", WARM: "#d97706", COLD: "#0284c7" };
const STATUS_LABEL: Record<LeadStatus, string> = {
  NEW: "Mới",
  CONFIRMED: "Đã chốt lịch",
  VIEWED: "Đã xem nhà",
  DEPOSIT: "Muốn đặt cọc",
  SIGNED: "Đã ký",
  LOST: "Không mua",
};

export function Badge({ label, color }: { label: string; color: string }) {
  return (
    <View style={[s.badge, { backgroundColor: color + "22" }]}>
      <Text style={[s.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

export function LevelBadge({ level }: { level: Level | null }) {
  return level ? <Badge label={level} color={LEVEL_COLOR[level]} /> : <Badge label="Chưa chấm" color={colors.muted} />;
}

export function StatusBadge({ status }: { status: LeadStatus }) {
  return <Badge label={STATUS_LABEL[status] ?? status} color={colors.blue} />;
}

export function Button({
  label,
  onPress,
  tone = "primary",
  disabled,
  style,
}: {
  label: string;
  onPress: () => void;
  tone?: "primary" | "green" | "danger" | "ghost";
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const bg = { primary: colors.blue, green: colors.green, danger: "#fff", ghost: "#fff" }[tone];
  const fg = tone === "danger" ? colors.red : tone === "ghost" ? colors.text : "#fff";
  const border = tone === "danger" ? colors.red : tone === "ghost" ? colors.border : bg;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={[s.button, { backgroundColor: bg, borderColor: border, opacity: disabled ? 0.5 : 1 }, style]}
    >
      <Text style={[s.buttonText, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

export function ErrorBox({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <View style={s.errorBox}>
      <Text style={s.errorText}>{message}</Text>
    </View>
  );
}

export function Loading() {
  return (
    <View style={{ padding: 24 }}>
      <ActivityIndicator color={colors.blue} />
    </View>
  );
}

export function Card({ children, onPress }: { children: React.ReactNode; onPress?: () => void }) {
  const inner = <View style={s.card}>{children}</View>;
  return onPress ? <Pressable onPress={onPress}>{inner}</Pressable> : inner;
}

export const s = StyleSheet.create({
  badge: { alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { fontSize: 12, fontWeight: "700" },
  button: { borderWidth: 1, borderRadius: 10, paddingVertical: 11, paddingHorizontal: 16, alignItems: "center" },
  buttonText: { fontSize: 15, fontWeight: "600" },
  errorBox: { backgroundColor: "#fef2f2", borderColor: "#fecaca", borderWidth: 1, borderRadius: 10, padding: 10, marginVertical: 8 },
  errorText: { color: "#b91c1c", fontSize: 13 },
  card: { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 10 },
  title: { fontSize: 20, fontWeight: "700", color: colors.text },
  h2: { fontSize: 13, fontWeight: "700", color: colors.muted, textTransform: "uppercase", marginTop: 16, marginBottom: 8 },
  muted: { color: colors.muted, fontSize: 13 },
  bold: { fontWeight: "600", color: colors.text, fontSize: 15 },
});
