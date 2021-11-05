/* global chrome */
import { createStartURL, getConfig } from "./config";
import { setupPageRules } from "./pageRules";
import { purge } from "./services";

const launchTiming71 = (sourceURL) => {
  chrome.windows.create({ type: 'popup', url: createStartURL(sourceURL) }).then(
    window => chrome.tabs.update(window.tabs[0].id, { autoDiscardable: false })
  );
};

const updateConfig = () => {
  getConfig().then(
    config => {
      chrome.action.disable();
      setupPageRules(config.supportedURLs);
    }
  );
};

chrome.runtime.onInstalled.addListener(updateConfig);
chrome.runtime.onStartup.addListener(updateConfig);

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

chrome.action.onClicked.addListener(
  (currentTab) => {
    launchTiming71(currentTab.url);
  },
);

chrome.runtime.onMessage.addListener(
  (msg, _, sendResponse) => {
    switch (msg.type) {

      case 'LAUNCH_T71':
        launchTiming71(msg.source);
        break;

      case 'GET_CONFIG':
        getConfig().then(
          config => sendResponse(config)
        );
        return true;

      default:
    }
  }
);
