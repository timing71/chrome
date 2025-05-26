import { createIframe } from '@timing71/common';
import { getAllServiceStates, getAnalysisAtIndex } from "./services";

const zip = require("@zip.js/zip.js");

const filenameFromManifest = (manifest, extension) => `${manifest.name} - ${manifest.description}.${extension}`.replaceAll(/[\\/]/g, '_');

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

  let prevState = null;
  let prevTime = null;
  let stateCounter = 0;

  for (const { state, timestamp } of states) {
    delete state.manifest;

    const timePart = `${Math.floor(timestamp / 1000)}`.padStart(11, '0');
    // If the new time part is identical to the previous time part (i.e. we had
    // two frames within a second) then the second should be written as a kframe
    // to avoid jumping states and having iframes not apply cleanly.
    const shouldBeIframe = !!prevState && (stateCounter++ % 10) !== 0 && timePart !== prevTime;

    const filePart = `${shouldBeIframe ? 'i' : ''}.json`;
    const filename = `${timePart}${filePart}`;

    const writableState = shouldBeIframe ? createIframe({ ...prevState }, state) : state;
    await writer.add(filename, new zip.TextReader(JSON.stringify(writableState)));
    onProgress({ item: idx++, total: stateCount, percent: Math.floor(100 * idx / stateCount) });
    prevState = { ...state };
    prevTime = timePart;
  }

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
