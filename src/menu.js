/* global chrome */

import { getConfig } from "./config";
import { pageIsSupported } from "./pageRules";

const showT71Page = (page) => {
  chrome.runtime.sendMessage({ type: 'SHOW_T71_PAGE', page, devMode: process.env.NODE_ENV === 'development' });
};

const launchT71 = (url) => {
  chrome.runtime.sendMessage({ type: 'LAUNCH_T71', source: url, devMode: process.env.NODE_ENV === 'development' });
};

const updateAndShowVersions = () => {

  const versionsHolder = document.getElementById('versions');
  versionsHolder.innerHTML = '';

  const pluginVersion = chrome.runtime.getManifest().version;

  versionsHolder.appendChild(makeVersionDiv('Plugin', pluginVersion));

  getConfig(true).then(
    config => {
      const { common, services, web } = config.versions;
      versionsHolder.appendChild(makeVersionDiv('Common', common));
      versionsHolder.appendChild(makeVersionDiv('Services', services));
      versionsHolder.appendChild(makeVersionDiv('Web', web));
    }
  );
};

const makeVersionDiv = (label, version) => {
  const div = document.createElement('div');
  div.innerText = `${label} v${version}`;
  return div;
};

document.addEventListener(
  'DOMContentLoaded',
  async () => {
    const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const supported = await pageIsSupported(currentTab.url);

    document.querySelectorAll('[data-t71-supported-page]').forEach(
      (thing) => {
        const shouldShow = !!thing.dataset.t71SupportedPage === supported;
        thing.style.display = shouldShow ? 'unset' : 'none';

        if (thing.dataset.t71Launch) {
          thing.onclick = () => launchT71(currentTab.url);
        }
      }
    );
    document.querySelectorAll('[data-t71-page]').forEach(
      (clickyThing) => {
        clickyThing.onclick = () => showT71Page(clickyThing.dataset.t71Page);
      }
    );

    const versionsHolder = document.getElementById('versions');
    versionsHolder.onclick = updateAndShowVersions;
    updateAndShowVersions();
  }
);
