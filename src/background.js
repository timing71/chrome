/* global chrome */
import { createPageURL, createStartURL, getConfig, objectFromEntries } from "./config";
import { deleteService, fetchService, listServices, saveTransientData, startService, updateServiceAnalysis, updateServiceState, purge } from "./services";
import { generateAnalysis, generateReplay } from "./replay";
import { readSetting, writeSetting } from "./settings";

const createWindow = (url) => {
  chrome.windows.create({ type: 'popup', url }).then(
    window => chrome.tabs.update(window.tabs[0].id, { autoDiscardable: false })
  );
};

const showT71Page = (page, devMode) => {
  createWindow(createPageURL(page, devMode));
};

const launchTiming71 = (sourceURL, devMode) => {
  createWindow(createStartURL(sourceURL, devMode));
};

chrome.runtime.onInstalled.addListener(getConfig);
chrome.runtime.onStartup.addListener(getConfig);

const PURGE_SERVICES_ALARM = 'purgeServices';

const installAlarm = () => {
  chrome.alarms.create(
    PURGE_SERVICES_ALARM,
    {
      periodInMinutes: 60
    }
  );
  purge();
};

chrome.runtime.onInstalled.addListener(installAlarm);
chrome.runtime.onStartup.addListener(purge);

chrome.alarms.onAlarm.addListener(
  (alarm) => {
    switch (alarm.name) {
      case PURGE_SERVICES_ALARM:
        purge();
        break;
      default:
        // Nothing here
    }
  }
);

chrome.runtime.onMessage.addListener(
  (msg, _, sendResponse) => {
    switch (msg.type) {

      case 'LAUNCH_T71':
        launchTiming71(msg.source, msg.devMode);
        break;

      case 'SHOW_T71_PAGE':
        showT71Page(msg.page, msg.devMode);
        break;

      case 'GET_CONFIG':
        getConfig().then(
          config => sendResponse(config)
        );
        return true;

      case 'INSECURE_FETCH':
        fetch(msg.url, msg.options).then(
          r => {
            r.text().then(
              t => sendResponse(t, r.headers && objectFromEntries(r.headers.entries()))
            );
          }
        ).catch(
          (e) => {
            // We can't pass the exception object through serialisation
            sendResponse({ error: e.message, originalMessage: msg });
          }
        );
        return true;

      case 'PASSTHROUGH':
        const { message, id } = msg;

        const nullReply = () => sendResponse({ id });

        switch (message.type) {
          case 'START_SERVICE':
            startService(message.uuid, message.source).then(
              () => {
                readSetting('recentSources', []).then(
                  recent => {
                    const newRecent = [
                      message.source,
                      ...recent.filter(r => r !== message.source)
                    ].slice(0, 20);
                    writeSetting('recentSources', newRecent);
                  }
                );

                sendResponse(
                  {
                    message: {
                      type: 'START_SERVICE_RETURN',
                      originalMessage: message
                    },
                    id
                  }
                );
              }
            );
            return true;

          case 'FETCH_SERVICE':
            fetchService(message.uuid, message.timestamp).then(
              ss => sendResponse({
                message: {
                  type: 'FETCH_SERVICE_RETURN',
                  ...ss
                },
                id
              })
            );
            return true;

          case 'UPDATE_SERVICE_STATE':
            updateServiceState(message.uuid, message.sessionIndex || 0, message.state, message.timestamp);
            nullReply();
            return true;

          case 'UPDATE_SERVICE_ANALYSIS':
            updateServiceAnalysis(message.uuid, message.sessionIndex || 0, message.analysis, message.timestamp);
            nullReply();
            return true;

          case 'SAVE_TRANSIENT_DATA':
            saveTransientData(message.uuid, message.data);
            nullReply();
            return true;

          case 'DELETE_SERVICE':
            deleteService(message.uuid).then(
              nullReply()
            );
            return true;

          case 'RETRIEVE_SERVICES_LIST':
            listServices().then(
              services => {
                sendResponse(
                  {
                    message: {
                      type: 'SERVICES_LIST',
                      services
                    },
                    id
                  }
                );
              }
            );
            return true;

          default:

        }

        break;

      default:
    }
  }
);

const CHUNK_SIZE = 128 * 1024;

chrome.runtime.onConnect.addListener(
  (port) => {
    port.onMessage.addListener(
      (msg) => {
        if (msg.type === 'GENERATE_SERVICE_REPLAY') {

          const handleProgress = (progress) => {
            port.postMessage({
              type: 'REPLAY_GENERATION_PROGRESS',
              progress
            });
          };

          generateReplay(msg.uuid, msg.sessionIndex, handleProgress).then(
            ({ blob, filename }) => {
              blob.arrayBuffer().then(
                (buffer) => {
                  const chunks = Math.ceil(buffer.byteLength / CHUNK_SIZE);

                  for (let chunkIdx = 0; chunkIdx < chunks; chunkIdx++) {
                    port.postMessage({
                      type: 'REPLAY_DATA',
                      filename,
                      chunkIdx,
                      totalChunks: chunks,
                      data: buffer.slice(CHUNK_SIZE * chunkIdx, CHUNK_SIZE * (chunkIdx + 1))
                    });
                  }
                }
              );
            }
          );

        }
        else if (msg.type === 'GENERATE_ANALYSIS_DOWNLOAD') {
          generateAnalysis(msg.uuid, msg.sessionIndex).then(
            ({ analysis, filename }) => {
              port.postMessage({
                type: 'ANALYSIS_GENERATION_FINISHED',
                analysis,
                filename
              });
            }
          );
        }
      }
    );
  }
);
