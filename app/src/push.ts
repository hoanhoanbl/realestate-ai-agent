import * as Device from "expo-device";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { savePushToken } from "./api";

// Khi app đang mở vẫn hiện thông báo
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Xin quyền, lấy token Expo Push và gửi cho backend. Trả về lý do nếu không đăng ký được (để hiện cho người dùng).
export async function registerForPush(): Promise<string | null> {
  if (!Device.isDevice) return "Thông báo đẩy chỉ hoạt động trên điện thoại thật.";
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Khách mới",
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== "granted") return "Chưa cấp quyền thông báo.";

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return "Chưa có projectId của EAS (chạy `npx eas init`), nên chưa lấy được token thông báo.";
  try {
    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    await savePushToken(token.data);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : "Không đăng ký được thông báo đẩy.";
  }
}
