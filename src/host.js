/* global chrome */

import { objectFromEntries } from "./config";
import { generateAnalysis, generateReplay } from "./replay";
import { deleteService, fetchService, listServices, listServiceSources, saveTransientData, startService, updateServiceAnalysis, updateServiceState } from "./services";

const _openWebsockets = {};

const _insecureFetches = {};
let _insecureFetchIndex = 0;

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

      case 'RETRIEVE_SERVICES_LIST':
        listServices().then(
          services => {
            send(
              {
                message: {
                  type: 'SERVICES_LIST',
                  services
                },
                id
              },
              origin
            );
          }
        );
        break;

      case 'RETRIEVE_SOURCES_LIST':
        listServiceSources().then(
          sources => {
            send(
              {
                message: {
                  type: 'SOURCES_LIST',
                  sources
                },
                id
              },
              origin
            );
          }
        );
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
        updateServiceState(message.uuid, message.sessionIndex || 0, message.state, message.timestamp);
        nullReply();
        break;

      case 'UPDATE_SERVICE_ANALYSIS':
        updateServiceAnalysis(message.uuid, message.sessionIndex || 0, message.analysis, message.timestamp);
        nullReply();
        break;

      case 'SAVE_TRANSIENT_DATA':
        saveTransientData(message.uuid, message.data);
        nullReply();
        break;

      case 'GENERATE_SERVICE_REPLAY':
        const generationProgress = (progress) => {
          send({
            type: 'REPLAY_GENERATION_PROGRESS',
            uuid: message.uuid,
            progress
          });
        };
        generateReplay(message.uuid, message.sessionIndex, generationProgress).then(
          () => send(
            {
              type: 'REPLAY_GENERATION_FINISHED',
              uuid: message.uuid
            },
            origin
          )
        );
        send({
          message: {
            type: 'REPLAY_GENERATION_STARTED',
            uuid: message.uuid
          },
          id
        }, origin);
        break;

      case 'GENERATE_ANALYSIS_DOWNLOAD':
        generateAnalysis(message.uuid, message.sessionIndex).then(
          () => send(
            {
              type: 'ANALYSIS_GENERATION_FINISHED',
              uuid: message.uuid
            },
            origin
          )
        );
        send({
          message: {
            type: 'ANALYSIS_GENERATION_STARTED',
            uuid: message.uuid
          },
          id
        }, origin);
        break;

      case 'DELETE_SERVICE':
        deleteService(message.uuid).then(
          nullReply()
        );
        break;

      case 'FETCH':
        const handleResponse = (response, headers) => {
          send({
            message: {
              type: 'FETCH_RETURN',
              data: response,
              headers: headers,
              originalMessage: message
            },
            id
          }, origin);
        };

        const handleError =  e => send(
          {
            message: {
              type: 'FETCH_FAILED',
              error: e,
              originalMessage: message
            },
            id
          },
          origin
        );

        if (message.url.startsWith('http://')) {
          // Insecure - route request through extension context
          const myIndex = _insecureFetchIndex++;
          _insecureFetches[myIndex] = [handleResponse, handleError];
          chrome.runtime.sendMessage(
            {
              type: 'INSECURE_FETCH',
              url: message.url,
              options: message.options,
              index: myIndex
            },
            (response) => response.error ? handleError(response.error) : handleResponse(response)
          );
        }
        else {
          fetch(message.url, message.options).then(
            r => {
              if (r.ok) {
                r.text().then(
                  t => handleResponse(t, r.headers && objectFromEntries(r.headers.entries()))
                );
              }
              else {
                handleError(r.error);
              }
            }
          ).catch(
            handleError
          );
        }
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
              if (!!message.autoReconnect) {
                handleMessage({ data, origin }); // and thus open a new one
              }
              else {
                send({
                  type: 'WEBSOCKET_CLOSE',
                  tag: message.tag
                }, origin);
              }
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

      case 'SHOW_T71_PAGE':
        chrome.runtime.sendMessage(message);
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
