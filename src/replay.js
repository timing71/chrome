import { createIframe, filenameFromManifest } from '@timing71/common';
import { getAllServiceStates, getAnalysisAtIndex } from "./services";

const zip = require("@zip.js/zip.js");

const STATES_PAGE_SIZE = 1000;

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

  let prevState = null;
  let pendingState = null;
  let pendingTimestamp = null;
  let stateCounter = 0;

  for (let offset=0; offset <= stateCount; offset += STATES_PAGE_SIZE) {
    // Note: states is implicitly sorted per the `where` clause used in the Dexie query.
    // https://github.com/dexie/Dexie.js/issues/300 would be useful here... but
    // we should "only" be dealing with a few hundred MB of data
    states = await getAllServiceStates(serviceUUID, sessionIndex);
    const statesArray = await states.offset(offset).limit(STATES_PAGE_SIZE).toArray();

    let idx = offset;

    for (const { state, timestamp } of statesArray) {
      delete state.manifest;

      const timePart = `${Math.floor(timestamp / 1000)}`.padStart(11, '0');

      if (pendingTimestamp === timePart) {
        // A newer state within the same second as the previous state; throw
        // away the older one and add the newer one in its place.
        pendingState = state;
      }
      else if (!!pendingState) {
        const shouldBeIframe = !!prevState && (stateCounter++ % 10) !== 0;
        const filePart = `${shouldBeIframe ? 'i' : ''}.json`;
        const filename = `${timePart}${filePart}`;

        const writableState = shouldBeIframe ? createIframe({ ...prevState }, pendingState) : pendingState;
        try {
          await writer.add(
            filename,
            new zip.TextReader(JSON.stringify(writableState))
          );
        }
        catch (e) {
          console.warn(e); //eslint-disable-line no-console
          // Most likely a "file already exists" error from zip.js although we
          // have made every effort to avoid these
        }
        prevState = { ...pendingState };
      }

      onProgress({ item: idx++, total: stateCount, percent: Math.floor(100 * idx / stateCount) });
      pendingState = { ...state };
      pendingTimestamp = timePart;
    }
  }

  const finalFilename = `${pendingTimestamp}.json`;
  try {
    await writer.add(
      finalFilename,
      new zip.TextReader(JSON.stringify(pendingState))
    );
  }
  catch (e) {
    console.warn(e); //eslint-disable-line no-console
    // Most likely a "file already exists" error from zip.js although we
    // have made every effort to avoid these
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

  // Convert manifest JS timestamp to Unix timestamp
  const manifest = analysis.state.manifest;
  manifest.startTime = Math.floor(manifest.startTime / 1000);

  return {
    analysis: json,
    filename: filenameFromManifest(manifest, 'json')
  };
};
