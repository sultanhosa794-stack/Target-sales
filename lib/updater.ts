import { Alert, Platform } from "react-native";
import Constants from "expo-constants";
import * as FileSystem from "expo-file-system/legacy";
import * as IntentLauncher from "expo-intent-launcher";
import { api } from "./backend";

type ConfigRow = { key: string; value: unknown };
type GitHubAsset = { name?: string; browser_download_url?: string };
type GitHubRelease = { tag_name?: string; name?: string; body?: string; assets?: GitHubAsset[] };

export type UpdateInfo = {
  currentVersion: string;
  currentBuild: number;
  latestVersion: string;
  latestBuild: number;
  apkUrl: string | null;
  notes: string | null;
  available: boolean;
};

const RELEASE_API = "https://api.github.com/repos/sultanhosa794-stack/Target-sales/releases/latest";

function num(v: unknown, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function parseTag(tag?: string) {
  const m = String(tag ?? "").match(/^v(.+)-b(\d+)$/i);
  return m ? { version: m[1], build: Number(m[2]) } : null;
}

async function getReleaseInfo(currentVersion: string, currentBuild: number): Promise<UpdateInfo | null> {
  try {
    const res = await fetch(RELEASE_API, {
      headers: { Accept: "application/vnd.github+json", "User-Agent": "Target-Sales-App" },
    });
    if (!res.ok) return null;
    const release = (await res.json()) as GitHubRelease;
    const parsed = parseTag(release.tag_name);
    if (!parsed) return null;
    const asset = release.assets?.find((a) => a.name === "Target-Sales.apk") ?? release.assets?.find((a) => a.name?.endsWith(".apk"));
    const apkUrl = asset?.browser_download_url?.startsWith("http") ? asset.browser_download_url : null;
    return {
      currentVersion,
      currentBuild,
      latestVersion: parsed.version,
      latestBuild: parsed.build,
      apkUrl,
      notes: release.body ?? release.name ?? null,
      available: Platform.OS === "android" && parsed.build > currentBuild && !!apkUrl,
    };
  } catch {
    return null;
  }
}

export async function checkForAppUpdate(): Promise<UpdateInfo> {
  const currentVersion = Constants.expoConfig?.version ?? "1.1.1";
  const currentBuild = num(Constants.expoConfig?.android?.versionCode, 2);

  const release = await getReleaseInfo(currentVersion, currentBuild);
  if (release) return release;

  const rows = await api<ConfigRow[]>("/rest/v1/app_config?select=key,value&key=in.(latest_app_version,latest_android_version_code,latest_android_apk_url,latest_update_notes)");
  const map = new Map(rows.map((r) => [r.key, r.value]));
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
    available: Platform.OS === "android" && latestBuild > currentBuild && !!apkUrl,
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
  Alert.alert("التحديث غير منشور بعد", "لا يوجد إصدار APK منشور حاليًا. بعد نجاح البناء سيتم نشره تلقائيًا ويظهر هنا مباشرة.");
}
