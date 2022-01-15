import { fetchService, getAllServiceStates } from "./services";

const zip = require("@zip.js/zip.js");
const FileSaver = require('file-saver');

const filenameFromManifest = (manifest, extension) => `${manifest.name} - ${manifest.description}.${extension}`;

export const generateReplay = async (serviceUUID, onProgress) => {
  let states = await getAllServiceStates(serviceUUID);
  const stateCount = await states.count();
  console.log(`Creating replay for ${serviceUUID} with ${stateCount} states`); //eslint-disable-line no-console

  const blobWriter = new zip.BlobWriter("application/zip");
  const writer = new zip.ZipWriter(blobWriter);

  const finalState = await states.last();
  const manifest =
  {
    ...finalState.state.manifest,
    version: 1
  };
  await writer.add(
    'manifest.json',
    new zip.TextReader(JSON.stringify(manifest))
  );

  states = await getAllServiceStates(serviceUUID);

  let idx = 0;

  await states.each(
    ({ state, timestamp }) => {
      delete state.manifest;
      const filename = `${Math.floor(timestamp / 1000)}.json`.padStart(16, '0');

      onProgress({ item: idx, total: stateCount, percent: Math.floor(100 * ++idx / stateCount) });

      return writer.add(
        filename,
        new zip.TextReader(JSON.stringify(state))
      );
    }
  );

  const blob = blobWriter.getData();

  FileSaver.saveAs(
    blob,
    filenameFromManifest(manifest, 'zip')
  );

};

export const generateAnalysis = async (serviceUUID) => {
  const { analysis, state } = await fetchService(serviceUUID);

  const json = JSON.stringify(analysis);
  const blob = new Blob([json], { type: 'application.json;charset=utf-8' });
  FileSaver.saveAs(
    blob,
    filenameFromManifest(state.manifest, 'json')
  );
};
