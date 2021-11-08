/* global chrome */

const URL_ROOT = process.env.NODE_ENV === 'production' ? 'https://beta.timing71.org' : 'http://localhost:3000';

export const createStartURL = (source) => (`${URL_ROOT}/start?source=${source}`);

let _config = {};

export const getConfig = async () => {
  if (Object.entries(_config).length === 0) {
    try {
      const response = await fetch(`${URL_ROOT}/pluginConfig.json`);
      if (response.status === 200) {
        _config = await response.json();
        chrome.storage.local.set({ 'config': _config });
      }
    }
    catch (e) {
      _config = await chrome.storage.local.get(['config']);
    }
  }

  return Promise.resolve(_config);
};


export const getClientSideConfig = () => {
  return new Promise(
    (resolve) => {
      chrome.runtime.sendMessage({ type: 'GET_CONFIG' }, resolve);
    }
  );
};
