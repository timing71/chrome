import { fetchService, getAllServiceStates } from "./services";

const JSZip = require('jszip');
const FileSaver = require('file-saver');

const filenameFromManifest = (manifest, extension) => `${manifest.name} - ${manifest.description}.${extension}`;

export const generateReplay = async (serviceUUID) => {
  const states = await getAllServiceStates(serviceUUID);
  const zipfile = new JSZip();

  const finalState = states[states.length - 1];
  const manifest =
  {
    ...finalState.state.manifest,
    version: 1
  };
  zipfile.file(
    'manifest.json',
    JSON.stringify(manifest)
  );

  states.forEach(
    ({ state, timestamp }) => {
      delete state.manifest;
      const filename = `${Math.floor(timestamp / 1000)}.json`.padStart(16, '0');
      zipfile.file(
        filename,
        JSON.stringify(state)
      );
    }
  );

  const blob = await zipfile.generateAsync({ type: 'blob' });
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
