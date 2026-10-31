import Storage from 'expo-sqlite/kv-store';

/** What the game's progress code expects of `localStorage`, kept in the app's own database. */
export const storage = {
  getItem: (key) => Storage.getItemSync(key),
  setItem: (key, value) => Storage.setItemSync(key, value),
  removeItem: (key) => Storage.removeItemSync(key)
};
