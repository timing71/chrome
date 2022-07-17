/* global chrome */

const DEV_URL_ROOT =  'http://localhost:3000';
const PROD_URL_ROOT = 'https://beta.timing71.org';

const URL_ROOT = process.env.NODE_ENV === 'production' ? PROD_URL_ROOT : DEV_URL_ROOT;

export const createStartURL = (source, devMode=false) => (`${devMode ? DEV_URL_ROOT : PROD_URL_ROOT}/start?source=${encodeURIComponent(source)}`);

export const createPageURL = (page, devMode=false) => (`${devMode ? DEV_URL_ROOT : PROD_URL_ROOT}/${page}`);

let _config = {};

export const getConfig = async (forceReload=false) => {
  if (!_config || Object.entries(_config).length === 0 || forceReload) {
    try {
      const response = await fetch(`${URL_ROOT}/pluginConfig.json`);
      if (response.status === 200) {
        _config = await response.json();
        chrome.storage.local.set({ 'config': _config });
      }
      else {
        throw response.status;
      }
    }
    catch (e) {
      const stored = await chrome.storage.local.get(['config']);
      _config = stored.config;
    }
  }

  return Promise.resolve(_config || {});
};


export const getClientSideConfig = () => {
  return new Promise(
    (resolve) => {
      chrome.runtime.sendMessage({ type: 'GET_CONFIG' }, resolve);
    }
  );
};

export function objectFromEntries(entries) {
  const obj = {};

  for (let pair of entries) {
    obj[pair[0]] = pair[1];
  }

  return obj;
}
