import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";
import { api, getStoredProfile } from "./backend";

const SHIFT_IDS_KEY = "target_sales_shift_notification_ids";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function expoProjectId() {
  const eas = (Constants.expoConfig?.extra as any)?.eas?.projectId;
  return Constants.easConfig?.projectId ?? (typeof eas === "string" ? eas : undefined);
}

export async function registerRemotePushToken() {
  const profile = await getStoredProfile();
  if (!profile) return null;

  const projectId = expoProjectId();
  if (!projectId) return null;

  const permission = await Notifications.getPermissionsAsync();
  const finalPermission = permission.status === "granted" ? permission : await Notifications.requestPermissionsAsync();
  if (finalPermission.status !== "granted") return null;

  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  if (!token) return null;

  await api("/rest/v1/rpc/register_my_push_token", {
    method: "POST",
    body: JSON.stringify({
      p_expo_token: token,
      p_platform: Platform.OS,
      p_device_label: `${Platform.OS} Target & Sales`,
    }),
  });

  return token;
}

export async function prepareNotifications() {
  const permission = await Notifications.getPermissionsAsync();
  if (permission.status !== "granted") {
    await Notifications.requestPermissionsAsync();
  }
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("target-sales-alerts", {
      name: "تنبيهات Target & Sales",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 400, 250, 400],
      sound: "default",
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  }
  try { await registerRemotePushToken(); } catch {}
}

export async function cancelShiftReminders() {
  const raw = await SecureStore.getItemAsync(SHIFT_IDS_KEY);
  if (!raw) return;
  try {
    const ids: string[] = JSON.parse(raw);
    await Promise.all(ids.map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined)));
  } finally {
    await SecureStore.deleteItemAsync(SHIFT_IDS_KEY);
  }
}

export async function scheduleEveningShiftReminders() {
  await prepareNotifications();
  await cancelShiftReminders();

  const now = new Date();
  const times = [
    [15, 0],
    [15, 5],
    [15, 10],
    [15, 20],
    [15, 30],
    [16, 0],
  ];
  const ids: string[] = [];

  for (const [hour, minute] of times) {
    const when = new Date(now);
    when.setHours(hour, minute, 0, 0);
    if (when.getTime() <= now.getTime()) continue;
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: "حان وقت بداية الشفت",
        body: "ابدأ الشفت من موقعك المعتمد أو سجّل الغياب لهذا اليوم.",
        sound: "default",
        data: { screen: "home", kind: "shift_reminder" },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: when,
        channelId: Platform.OS === "android" ? "target-sales-alerts" : undefined,
      },
    });
    ids.push(id);
  }

  await SecureStore.setItemAsync(SHIFT_IDS_KEY, JSON.stringify(ids));
  return ids.length;
}

export async function showLocalNotification(title: string, body: string, type = "general") {
  await prepareNotifications();
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: "default",
      data: { type },
    },
    trigger: null,
  });
}
