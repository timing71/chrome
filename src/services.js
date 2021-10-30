import Dexie from "dexie";

const db = new Dexie('timing71_services');

const DEFAULT_STATE = {
  cars: [],
  session: {},
  messages: [],
  manifest: {}
};

db.version(2).stores({
  services: 'uuid',
  service_states: '[uuid+timestamp], uuid, timestamp'
}).upgrade(
  tx => {
    return tx.table('service_states').toCollection().modify(
      ss => ({
        ...ss,
        timestamp: ss.state?.lastUpdated || 0
      })
    );
  }
);

export const startService = async (uuid, source) => {
  await db.services.put({
    uuid,
    source,
    startTime: Date.now()
  });
  await db.service_states.put({
    uuid,
    state: { ...DEFAULT_STATE },
    timestamp: Date.now()
  });
};

export const terminateService = async (uuid) => {
  await db.services.delete(uuid);
  await db.service_states.delete(uuid);
};

export const fetchService = async (uuid, timestamp=null) => {
  const service = await db.services.get(uuid);
  const state = await db.service_states
    .where('[uuid+timestamp]')
    .between([uuid, Dexie.minKey], [uuid, timestamp || Dexie.maxKey], true, true)
    .last();
  return {
    service,
    state: state.state
  };
};

export const updateServiceState = async (uuid, state, timestamp=null) => {
  const myTimestamp = timestamp || Date.now();
  await db.service_states.put({
    uuid,
    state,
    timestamp: myTimestamp
  }, [uuid, myTimestamp]);
};
