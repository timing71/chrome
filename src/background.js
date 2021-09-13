/* global chrome */

import { setupPageRules } from "./pageRules";

const URL_ROOT = process.env.NODE_ENV === 'production' ? 'https://beta.timing71.org' : 'http://localhost:8080';

chrome.runtime.onInstalled.addListener(
  () => {
    chrome.action.disable();
    setupPageRules();
  },
);

chrome.action.onClicked.addListener(
  (currentTab) => {
    chrome.tabs.create({ url: `${URL_ROOT}/start?source=${currentTab.url}` });
  },
);
