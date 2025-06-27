import { createIframe, filenameFromManifest } from '@timing71/common';
import { getAllServiceStates, getAnalysisAtIndex } from "./services";

const zip = require("@zip.js/zip.js");

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
  // https://github.com/dexie/Dexie.js/issues/300 would be useful here... but
  // we should "only" be dealing with a few hundred MB of data
  states = await getAllServiceStates(serviceUUID, sessionIndex);
  const statesArray = await states.toArray();

  let idx = 0;

  let prevState = null;
  let prevTime = null;
  let stateCounter = 0;
  let prevFrameFailed = false;

  for (const { state, timestamp } of statesArray) {
    delete state.manifest;

    const timePart = `${Math.floor(timestamp / 1000)}`.padStart(11, '0');
    // If the new time part is identical to the previous time part (i.e. we had
    // two frames within a second) then the second should be written as a kframe
    // to avoid jumping states and having iframes not apply cleanly.
    const shouldBeIframe = prevFrameFailed ||
      (!!prevState &&
        (stateCounter++ % 10) !== 0 &&
        timePart !== prevTime
      );

    const filePart = `${shouldBeIframe ? 'i' : ''}.json`;
    const filename = `${timePart}${filePart}`;

    const writableState = shouldBeIframe ? createIframe({ ...prevState }, state) : state;
    try {
      await writer.add(
        filename,
        new zip.TextReader(JSON.stringify(writableState))
      );
      prevFrameFailed = false;
    }
    catch {
      // Most likely a "file already exists" error from zip.js
      // So long as we make the subsequent frame a keyframe, it's probably fine
      // to ignore this
      prevFrameFailed = true;
    }
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
