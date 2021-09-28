/* global chrome */

export const SUPPORTED_URLS = [
  'livetiming.alkamelsystems.com/[a-zA-Z0-9]+',
  'racecontrol.indycar.com',
  'live.lemanscup.com',
  'live.europeanlemansseries.com',
  'live.fiawec.com',
];

export const setupPageRules = () => {
  chrome.declarativeContent.onPageChanged.removeRules(
    undefined,
    () => {
      const rules = SUPPORTED_URLS.map(
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
