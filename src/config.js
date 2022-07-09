/* global chrome */

const URL_ROOT = process.env.NODE_ENV === 'production' ? 'https://beta.timing71.org' : 'http://localhost:3000';

export const createStartURL = (source) => (`${URL_ROOT}/start?source=${encodeURIComponent(source)}`);

export const createPageURL = (page) => (`${URL_ROOT}/${page}`);

let _config = {};

export const getConfig = async () => {
  if (!_config || Object.entries(_config).length === 0) {
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
