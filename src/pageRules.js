/* global chrome */

import { getClientSideConfig } from "./config";

export const setupPageRules = (supportedURLs) => {
  chrome.declarativeContent.onPageChanged.removeRules(
    undefined,
    () => {
      const rules = supportedURLs.map(
        regex => ({
          conditions: [
            new chrome.declarativeContent.PageStateMatcher({
              pageUrl: {
                urlMatches: regex
              },
            })
          ],
          actions: [new chrome.declarativeContent.ShowAction()]
        })
      );
      chrome.declarativeContent.onPageChanged.addRules(rules);
    }
  );
};

export const pageIsSupported = async (url) => {
  if (url.search(/timing71\.org|localhost/) >= 0) {
    return false;
  }
  const config = await getClientSideConfig();
  for (var i=0; i < (config.supportedURLs || []).length; i++) {
    const pattern = config.supportedURLs[i];
    const match = url.search(pattern);
    if (match >= 0) {
      return true;
    }
  }
  return false;
};
