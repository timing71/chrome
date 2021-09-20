/* global chrome */
import { setupPageRules } from "./pageRules";
import { fetchService, startService, terminateService, updateServiceState } from "./services";

const URL_ROOT = process.env.NODE_ENV === 'production' ? 'https://beta.timing71.org' : 'http://localhost:3000';

const openPorts = [];

chrome.runtime.onInstalled.addListener(
  () => {
    chrome.action.disable();
    setupPageRules();
  },
);

chrome.action.onClicked.addListener(
  (currentTab) => {
    chrome.tabs.create({ url: `${URL_ROOT}/start?source=${currentTab.url}` }).then(
      tab => chrome.tabs.update(tab.id, { autoDiscardable: false })
    );
  },
);

const handlePortMessage = (message, otherPort) => {
  switch(message.type) {
    case 'HANDSHAKE':
      otherPort.postMessage({
        type: 'HANDSHAKE_RETURN'
      });
      break;

    case 'START_SERVICE':
      startService(message.uuid, message.source).then(
        otherPort.postMessage({
          type: 'START_SERVICE_RETURN',
          originalMessage: message
        })
      );
      break;

    case 'TERMINATE_SERVICE':
      terminateService(message.uuid);
      break;

    case 'FETCH_SERVICE':
      fetchService(message.uuid).then(
        ss => otherPort.postMessage({
          type: 'FETCH_SERVICE_RETURN',
          ...ss
        })
      );
      break;

    case 'STORE_SERVICE_STATE':
      updateServiceState(message.uuid, message.state);
      break;

    case 'FETCH':
      fetch(message.url).then(
        response => response.text().then(
          text => otherPort.postMessage({
            type: 'FETCH_RETURN',
            data: text,
            originalMessage: message
          })
        )
      );
      break;

    case 'WEBSOCKET':
      const ws = new WebSocket(`${message.url}`);

      ws.onmessage = (msg) => {
        openPorts.forEach(
          openPort =>
            openPort.postMessage({
              type: 'WEBSOCKET_MESSAGE',
              data: msg.data,
              tag: message.tag
            }
          )
        );
      };

      break;

    default:
  }
};

chrome.runtime.onConnectExternal.addListener(
  (port) => {
    port.onMessage.addListener(handlePortMessage);

    port.onDisconnect.addListener(
      (p) => {
        const idx = openPorts.indexOf(p);
        if (idx >= 0) {
          openPorts.splice(idx, 1);
        }
      }
    );

    openPorts.push(port);
  }
);
