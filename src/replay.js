import { createIframe } from '@timing71/common';
import { getAllServiceStates, getAnalysisAtIndex } from "./services";

const zip = require("@zip.js/zip.js");

const filenameFromManifest = (manifest, extension) => `${manifest.name} - ${manifest.description}.${extension}`;

export const generateReplay = async (serviceUUID, sessionIndex=0, onProgress) => {
  let states = await getAllServiceStates(serviceUUID, sessionIndex);
  const stateCount = await states.count();
  console.log(`Creating replay for ${serviceUUID}:${sessionIndex} with ${stateCount} states`); //eslint-disable-line no-console

  const blobWriter = new zip.BlobWriter("application/zip");
  const writer = new zip.ZipWriter(blobWriter);

  const finalState = await states.last();
  const manifest =
  {
    ...finalState.state.manifest,
    startTime: Math.floor(finalState.state.manifest.startTime / 1000),
    version: 1
  };
  await writer.add(
    'manifest.json',
    new zip.TextReader(JSON.stringify(manifest))
  );

  // Note: states is implicitly sorted per the `where` clause used in the Dexie query.
  states = await getAllServiceStates(serviceUUID, sessionIndex);

  let idx = 0;

  const promises = [];

  let prevState = null;
  let stateCounter = 0;

  await states.each(
    ({ state, timestamp }) => {
      delete state.manifest;

      const shouldBeIframe = !!prevState && (stateCounter++ % 10) !== 0;

      const timePart = `${Math.floor(timestamp / 1000)}`.padStart(11, '0');
      const filePart = `${shouldBeIframe ? 'i' : ''}.json`;
      const filename = `${timePart}${filePart}`;

      const writableState = shouldBeIframe ? createIframe({ ...prevState }, state) : state;

      const promise = writer.add(
        filename,
        new zip.TextReader(JSON.stringify(writableState))
      ).then(
        () => {
          // Potential race condition here, but it's just progress feedback so might not be important...
          onProgress({ item: idx++, total: stateCount, percent: Math.floor(100 * idx / stateCount) });
        }
      ).catch(
        e => {
          // console.error(`Error adding state from timestamp ${timestamp}`, e);
          // Most likely a "file already exists" error from zip.js which we can
          // safely ignore
          return Promise.resolve();
        }
      );
      prevState = { ...state };
      promises.push(promise);
    }
  );

  await Promise.all(promises);

  await writer.close();

  const blob = await blobWriter.getData();

  return {
    blob,
    filename: filenameFromManifest(manifest, 'zip')
  };

};

export const generateAnalysis = async (serviceUUID, sessionIndex=0) => {
  const analysis = await getAnalysisAtIndex(serviceUUID, sessionIndex);

  const json = JSON.stringify(analysis.state);

  return {
    analysis: json,
    filename: filenameFromManifest(analysis.state.manifest, 'json')
  };
};
