/* global chrome */

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
