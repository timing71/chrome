/* global chrome */
import { createStartURL } from "./config";
import { setupPageRules } from "./pageRules";
import { fetchService, startService, terminateService, updateServiceState } from "./services";

const openPorts = [];
const openWebsockets = {};

const launchTiming71 = (sourceURL) => {
  chrome.windows.create({ type: 'popup', url: createStartURL(sourceURL) }).then(
    window => chrome.tabs.update(window.tabs[0].id, { autoDiscardable: false })
  );
};

chrome.runtime.onInstalled.addListener(
  () => {
    chrome.action.disable();
    setupPageRules();
  },
);

chrome.action.onClicked.addListener(
  (currentTab) => {
    launchTiming71(currentTab.url);
  },
);

chrome.runtime.onMessage.addListener(
  (msg) => {
    if (msg.type === 'LAUNCH_T71') {
      launchTiming71(msg.source);
    }
  }
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

    case 'UPDATE_SERVICE_STATE':
      updateServiceState(message.uuid, message.state, message.timestamp);
      break;

    case 'FETCH':
      fetch(message.url, message.options).then(
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

        ws.onopen = () => {
          openPorts.forEach(
            openPort =>
              openPort.postMessage({
                type: 'WEBSOCKET_OPEN',
                tag: message.tag
              }
            )
          );
        };

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
      else {
        otherPort.postMessage({
          type: 'WEBSOCKET_OPEN',
          tag: message.tag
        });
      }

      break;

      case 'WEBSOCKET_SEND':
        if (openWebsockets[message.tag]) {
          const ws = openWebsockets[message.tag];
          ws.send(message.data);
        }
        break;

      case 'WEBSOCKET_CLOSE':
        if (openWebsockets[message.tag]) {
          const ws = openWebsockets[message.tag];
          delete openWebsockets[message.tag];
          ws.close();
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
