import { Alert, Platform } from "react-native";
import Constants from "expo-constants";
import * as FileSystem from "expo-file-system/legacy";
import * as IntentLauncher from "expo-intent-launcher";
import { api } from "./backend";

type ConfigRow = { key: string; value: unknown };

export type UpdateInfo = {
  currentVersion: string;
  currentBuild: number;
  latestVersion: string;
  latestBuild: number;
  apkUrl: string | null;
  notes: string | null;
  available: boolean;
};

function num(v: unknown, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export async function checkForAppUpdate(): Promise<UpdateInfo> {
  const rows = await api<ConfigRow[]>("/rest/v1/app_config?select=key,value&key=in.(latest_app_version,latest_android_version_code,latest_android_apk_url,latest_update_notes)");
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const currentVersion = Constants.expoConfig?.version ?? "1.1.1";
  const currentBuild = num(Constants.expoConfig?.android?.versionCode, 2);
  const latestVersion = String(map.get("latest_app_version") ?? currentVersion);
  const latestBuild = num(map.get("latest_android_version_code"), currentBuild);
  const rawUrl = map.get("latest_android_apk_url");
  const apkUrl = typeof rawUrl === "string" && rawUrl.startsWith("http") ? rawUrl : null;
  const rawNotes = map.get("latest_update_notes");
  const notes = typeof rawNotes === "string" ? rawNotes : null;
  return {
    currentVersion,
    currentBuild,
    latestVersion,
    latestBuild,
    apkUrl,
    notes,
    available: Platform.OS === "android" && latestBuild > currentBuild,
  };
}

export async function downloadAndInstallUpdate(apkUrl: string, onProgress?: (p: number) => void) {
  if (Platform.OS !== "android") throw new Error("التحديث الداخلي متاح لأندرويد فقط حاليًا");
  const target = `${FileSystem.cacheDirectory}target-sales-update.apk`;
  try { await FileSystem.deleteAsync(target, { idempotent: true }); } catch {}
  const download = FileSystem.createDownloadResumable(apkUrl, target, {}, (progress) => {
    const total = progress.totalBytesExpectedToWrite || 1;
    onProgress?.(Math.max(0, Math.min(1, progress.totalBytesWritten / total)));
  });
  const result = await download.downloadAsync();
  if (!result?.uri) throw new Error("تعذر تنزيل ملف التحديث");
  const contentUri = await FileSystem.getContentUriAsync(result.uri);
  await IntentLauncher.startActivityAsync("android.intent.action.VIEW", {
    data: contentUri,
    flags: 1,
    type: "application/vnd.android.package-archive",
  });
}

export async function explainMissingUpdateUrl() {
  Alert.alert("التحديث غير منشور بعد", "النظام جاهز للتحديث الداخلي، لكن يجب أولًا نشر ملف APK الجديد في رابط ثابت وآمن.");
}
