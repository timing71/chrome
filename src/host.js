/* global chrome */

import ReconnectingEventSource from "reconnecting-eventsource";
import { objectFromEntries } from "./config";
import { readSetting, readSettings, writeSettings } from "./settings";

const FileSaver = require('file-saver');

const _openWebsockets = {};
const _openEventSources = {};

const _insecureFetches = {};
let _insecureFetchIndex = 0;

const send = (data, origin='*') => {
  window.parent.postMessage(
    data, origin
  );
};

const PASSTHROUGH_MESSAGE_TYPES = [
  'RETRIEVE_SERVICES_LIST',
  'START_SERVICE',
  'FETCH_SERVICE',
  'UPDATE_SERVICE_STATE',
  'UPDATE_SERVICE_ANALYSIS',
  'SAVE_TRANSIENT_DATA',
  'SET_SERVICE_PROTECTION',
  'DELETE_SERVICE'
];

const handleMessage = ({ data, origin }) => {
  if (origin.match(/https?:\/\/(localhost|.*\.timing71\.org)/)) {
    const { message, id } = data;

    const nullReply = () => send({ id }, origin);

    if (PASSTHROUGH_MESSAGE_TYPES.includes(message.type)) {

      const handleResponse = (response) => {
        send(response);
      };

      chrome.runtime.sendMessage(
        {
          type: 'PASSTHROUGH',
          message,
          id
        },
        handleResponse
      );
    }
    else {
      switch (message.type) {
        case 'RETRIEVE_SETTINGS':

        readSettings().then(
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
          writeSettings(message.settings);
          nullReply();
          break;

        case 'RETRIEVE_SOURCES_LIST':
          readSetting('recentSources', []).then(
            sources => send({
              message: {
                type: 'SOURCES_LIST',
                sources
              },
              id
            }, origin)
          );
          break;

        case 'GENERATE_SERVICE_REPLAY':

          const bgPort = chrome.runtime.connect();
          let replayData = [];

          bgPort.onMessage.addListener(
            (msg) => {

              if (msg.type === 'REPLAY_GENERATION_PROGRESS') {
                send({
                  type: 'REPLAY_GENERATION_PROGRESS',
                  uuid: message.uuid,
                  progress: msg.progress
                }, origin);
              }
              else if (msg.type === 'REPLAY_DATA') {
                replayData = replayData.concat(msg.data);

                if (msg.chunkIdx === msg.totalChunks - 1) {
                  // We have all the data
                  FileSaver.saveAs(
                    new Blob([new Uint8Array(replayData)]),
                    msg.filename
                  );

                  send({
                    type: 'REPLAY_GENERATION_FINISHED',
                    uuid: message.uuid
                  }, origin);

                  bgPort.disconnect();
                }
              }
            }
          );

          bgPort.postMessage(message);

          send({
            message: {
              type: 'REPLAY_GENERATION_STARTED',
              uuid: message.uuid
            },
            id
          }, origin);
          return true;

        case 'GENERATE_ANALYSIS_DOWNLOAD':
          const agPort = chrome.runtime.connect();
          agPort.onMessage.addListener(
            (msg) => {
              if (msg.type === 'ANALYSIS_GENERATION_FINISHED') {
                const blob = new Blob([msg.analysis], { type: 'application.json;charset=utf-8' });
                FileSaver.saveAs(blob, msg.filename);

                agPort.disconnect();

                send({
                  type: 'ANALYSIS_GENERATION_FINISHED',
                  uuid: message.uuid
                }, origin);
              }
            }
          );

          agPort.postMessage(message);

          send({
            message: {
              type: 'ANALYSIS_GENERATION_STARTED',
              uuid: message.uuid
            },
            id
          }, origin);
          return true;

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
            const ws = new WebSocket(`${message.url}`, message.protocols || []);

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

        case 'OPEN_EVENT_SOURCE':
          if (!_openEventSources[message.tag]) {
            const es = new ReconnectingEventSource(message.url);
            es.onopen = () => send({
              type: 'EVENT_SOURCE_OPEN',
              tag: message.tag
            }, origin);

            es.onerror = (e) => send({
              type: 'EVENT_SOURCE_ERROR',
              tag: message.tag,
              error: e
            }, origin);

            es.onmessage = (msg) => send({
              type: 'EVENT_SOURCE_MESSAGE',
              tag: message.tag,
              data: msg.data
            });

          }
          else {
            send({
              type: 'EVENT_SOURCE_OPEN',
              tag: message.tag
            }, origin);
          }
          break;

        case 'CLOSE_EVENT_SOURCE':
          if (_openEventSources[message.tag]) {
            const es = _openEventSources[message.tag];
            delete _openEventSources[message.tag];
            es.close();
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

  }
};

document.addEventListener(
  'DOMContentLoaded',
  () => {
    window.addEventListener('message', handleMessage);
  }
);
