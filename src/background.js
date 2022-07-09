/* global chrome */
import { createPageURL, createStartURL, getConfig, objectFromEntries } from "./config";
import { purge } from "./services";

const showT71Page = (page) => {
  return chrome.windows.create({ type: 'popup', url: createPageURL(page) });
};

const launchTiming71 = (sourceURL) => {
  chrome.windows.create({ type: 'popup', url: createStartURL(sourceURL) }).then(
    window => chrome.tabs.update(window.tabs[0].id, { autoDiscardable: false })
  );
};

chrome.runtime.onInstalled.addListener(getConfig);
chrome.runtime.onStartup.addListener(getConfig);

const PURGE_SERVICES_ALARM = 'purgeServices';

const installAlarm = () => {
  chrome.alarms.create(
    PURGE_SERVICES_ALARM,
    {
      periodInMinutes: 60
    }
  );
  purge();
};

chrome.runtime.onInstalled.addListener(installAlarm);
chrome.runtime.onStartup.addListener(purge);

chrome.alarms.onAlarm.addListener(
  (alarm) => {
    switch (alarm.name) {
      case PURGE_SERVICES_ALARM:
        purge();
        break;
      default:
        // Nothing here
    }
  }
);

chrome.runtime.onMessage.addListener(
  (msg, _, sendResponse) => {
    switch (msg.type) {

      case 'LAUNCH_T71':
        launchTiming71(msg.source);
        break;

      case 'SHOW_T71_PAGE':
        showT71Page(msg.page);
        break;

      case 'GET_CONFIG':
        getConfig().then(
          config => sendResponse(config)
        );
        return true;

      case 'INSECURE_FETCH':
        fetch(msg.url, msg.options).then(
          r => {
            r.text().then(
              t => sendResponse(t, r.headers && objectFromEntries(r.headers.entries()))
            );
          }
        );
        return true;

      default:
    }
  }
);
