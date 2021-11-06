/* global chrome */

import { fetchService, startService, updateServiceState } from "./services";

const _openWebsockets = {};

const send = (data, origin='*') => {
  window.parent.postMessage(
    data, origin
  );
};

const handleMessage = ({ data, origin }) => {
  if (origin.match(/https?:\/\/(localhost|.*\.timing71\.org)/)) {
    const { message, id } = data;

    const nullReply = () => send({ id }, origin);

    switch (message.type) {
      case 'RETRIEVE_SETTINGS':
        chrome.storage.sync.get(
          null,
          (settings) => {
            send(
              {
                message: {
                  type: 'SETTINGS_RETRIEVED',
                  settings
                },
                id
              },
              origin
            );
          }
        );
        break;

      case 'STORE_SETTINGS':
        chrome.storage.sync.set(message.settings);
        nullReply();
        break;

      case 'START_SERVICE':
          startService(message.uuid, message.source).then(
            send(
              {
                message: {
                  type: 'START_SERVICE_RETURN',
                  originalMessage: message
                },
                id
              },
              origin
            )
          );
          break;

      case 'FETCH_SERVICE':
        fetchService(message.uuid, message.timestamp).then(
          ss => send({
            message: {
              type: 'FETCH_SERVICE_RETURN',
              ...ss
            },
            id
          }, origin)
        );
        break;

      case 'UPDATE_SERVICE_STATE':
        updateServiceState(message.uuid, message.state, message.timestamp);
        nullReply();
        break;

      case 'FETCH':
        fetch(message.url, message.options).then(
          response => response.text().then(
            text => send({
              message: {
                type: 'FETCH_RETURN',
                data: text,
                originalMessage: message
              },
              id
            }, origin)
          )
        );
        break;

      case 'OPEN_WEBSOCKET':
        if (!_openWebsockets[message.tag]) {
          const ws = new WebSocket(`${message.url}`);

          ws.onopen = () => {
            send(
              {
                type: 'WEBSOCKET_OPEN',
                tag: message.tag
              },
              origin
            );
          };

          ws.onmessage = (msg) => {
            send(
              {
                type: 'WEBSOCKET_MESSAGE',
                data: msg.data,
                tag: message.tag
              },
              origin
            );
          };

          ws.onclose = () => {
            if (_openWebsockets[message.tag]) {
              delete _openWebsockets[message.tag];
              handleMessage({ data, origin }); // and thus open a new one
            }
          };

          _openWebsockets[message.tag] = ws;
          nullReply();
        }
        else {
          send({
            type: 'WEBSOCKET_OPEN',
            tag: message.tag
          }, origin);
        }
        break;

      case 'WEBSOCKET_SEND':
        if (_openWebsockets[message.tag]) {
          const ws = _openWebsockets[message.tag];
          ws.send(message.data);
        }
        nullReply();
        break;

      case 'WEBSOCKET_CLOSE':
        if (_openWebsockets[message.tag]) {
          const ws = _openWebsockets[message.tag];
          delete _openWebsockets[message.tag];
          ws.close();
        }
        nullReply();
        break;

      default:
        console.log("Received unhandled message", data);  // eslint-disable-line no-console

    }
  }
};

document.addEventListener(
  'DOMContentLoaded',
  () => {
    window.addEventListener('message', handleMessage);
  }
);