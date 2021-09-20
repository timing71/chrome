/* global chrome */
import { setupPageRules } from "./pageRules";
import { fetchService, startService, terminateService, updateServiceState } from "./services";

const URL_ROOT = process.env.NODE_ENV === 'production' ? 'https://beta.timing71.org' : 'http://localhost:3000';

const openPorts = [];
const openWebsockets = {};

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

const handlePortMessage = (msg, otherPort) => {
  const { message, messageIdx } = msg;
  switch(message.type) {
    case 'HANDSHAKE':
      otherPort.postMessage({
        message: {
          type: 'HANDSHAKE_RETURN',
        },
        messageIdx
      });
      break;

    case 'START_SERVICE':
      startService(message.uuid, message.source).then(
        otherPort.postMessage({
          message: {
            type: 'START_SERVICE_RETURN',
            originalMessage: message
          },
          messageIdx
        })
      );
      break;

    case 'TERMINATE_SERVICE':
      terminateService(message.uuid);
      break;

    case 'FETCH_SERVICE':
      fetchService(message.uuid).then(
        ss => otherPort.postMessage({
          message: {
            type: 'FETCH_SERVICE_RETURN',
            ...ss
          },
          messageIdx
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
            message: {
              type: 'FETCH_RETURN',
              data: text,
              originalMessage: message
            },
            messageIdx
          })
        )
      );
      break;

    case 'OPEN_WEBSOCKET':
      if (!openWebsockets[message.tag]) {
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

        ws.onclose = () => {
          if (openWebsockets[message.tag]) {
            delete openWebsockets[message.tag];
            handlePortMessage(msg, otherPort); // and thus open a new one
          }
        };

        openWebsockets[message.tag] = ws;
      }

      break;

      case 'WEBSOCKET_SEND':
        if (openWebsockets[message.tag]) {
          const ws = openWebsockets[message.tag];
          ws.send(message.data);
        }
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
