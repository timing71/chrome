import { getAllServiceStates } from "./services";

const JSZip = require('jszip');
const FileSaver = require('file-saver');

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
    `${manifest.name} - ${manifest.description}.zip`
  );

};
