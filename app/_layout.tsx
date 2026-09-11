import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { C } from '@/lib/theme';

export default function Layout() {
  return <><StatusBar style="dark" backgroundColor={C.bg}/><Stack screenOptions={{headerShown:false,animation:'fade'}}/></>;
}
