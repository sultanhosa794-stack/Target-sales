import { useEffect } from "react";
import { enablePushRegistrationRetry } from "../lib/notifications";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

export default function RootLayout() {
  useEffect(()=>{enablePushRegistrationRetry()},[]);
  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, animation: "fade" }} />
    </>
  );
}
