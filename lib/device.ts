import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const KEY = 'target_sales_installation_id_v1';

function randomId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

export async function getDeviceToken() {
  if (Platform.OS === 'web') {
    let id = localStorage.getItem(KEY);
    if (!id) { id = randomId(); localStorage.setItem(KEY, id); }
    return id;
  }
  let id = await SecureStore.getItemAsync(KEY);
  if (!id) { id = randomId(); await SecureStore.setItemAsync(KEY, id); }
  return id;
}

export function getDeviceLabel() {
  return Platform.OS === 'android' ? 'Android' : Platform.OS === 'ios' ? 'iPhone' : 'Web';
}
