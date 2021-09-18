import Dexie from "dexie";

const db = new Dexie('timing71_services');

const DEFAULT_STATE = {
  cars: [],
  session: {},
  messages: [],
  manifest: {}
};

db.version(1).stores({
  services: 'uuid',
  service_states: 'uuid'
});

export const startService = async (uuid, source) => {
  await db.services.put({
    uuid,
    source,
    startTime: Date.now()
  });
  await db.service_states.put({
    uuid,
    state: { ...DEFAULT_STATE }
  });
};

export const terminateService = async (uuid) => {
  await db.services.delete(uuid);
  await db.service_states.delete(uuid);
};

export const fetchService = async (uuid) => {
  const service = await db.services.get(uuid);
  const state = await db.service_states.get(uuid);
  return {
    service,
    state: state.state
  };
};

export const updateServiceState = async (uuid, state) => {
  await db.service_states.put({ uuid, state });
};
