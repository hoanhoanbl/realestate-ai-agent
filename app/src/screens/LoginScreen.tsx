import { useState } from "react";
import { KeyboardAvoidingView, Platform, Text, TextInput, View } from "react-native";
import { login, type SessionUser } from "../api";
import { Button, ErrorBox, colors, s } from "../ui";

export default function LoginScreen({ onLoggedIn }: { onLoggedIn: (token: string, user: SessionUser) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const r = await login(email.trim(), password);
      onLoggedIn(r.accessToken, r.user);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Đăng nhập thất bại.");
    } finally {
      setBusy(false);
    }
  }

  const input = {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    backgroundColor: "#fff",
    marginBottom: 12,
    fontSize: 16,
  } as const;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, justifyContent: "center", padding: 24 }}>
      <Text style={[s.title, { marginBottom: 4 }]}>RealEstate AI</Text>
      <Text style={[s.muted, { marginBottom: 24 }]}>Đăng nhập dành cho nhân viên</Text>
      <TextInput
        style={input}
        placeholder="Email"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput style={input} placeholder="Mật khẩu" secureTextEntry value={password} onChangeText={setPassword} onSubmitEditing={submit} />
      <ErrorBox message={error} />
      <View style={{ marginTop: 4 }}>
        <Button label={busy ? "Đang đăng nhập..." : "Đăng nhập"} onPress={submit} disabled={busy || !email || !password} />
      </View>
    </KeyboardAvoidingView>
  );
}
