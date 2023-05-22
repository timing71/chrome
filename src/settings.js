/* global chrome */

export async function readSettings() {
  return await chrome.storage.sync.get();
}

export async function readSetting(key, defaultValue=undefined) {
  const stored = await chrome.storage.sync.get(key);
  return stored[key] || defaultValue;
}

export async function writeSettings(settings) {
  return await chrome.storage.sync.set(settings);
}

export async function writeSetting(key, value) {
  await chrome.storage.sync.set({ [key]: value });
}
