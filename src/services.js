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

db.version(3).stores({
  services: 'uuid,startTime',
  service_states: '[uuid+timestamp], uuid, timestamp'
});

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

const getServiceStateAt = (uuid, timestamp=null) => {
  return db.service_states
  .where('[uuid+timestamp]')
  .between([uuid, Dexie.minKey], [uuid, timestamp || Dexie.maxKey], true, true)
  .last();
};

export const fetchService = async (uuid, timestamp=null) => {
  const service = await db.services.get(uuid);
  const state = await getServiceStateAt(uuid, timestamp);
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

export const getAllServiceStates = async (uuid) => {
  const states = await db.service_states
    .where('[uuid+timestamp]')
    .between([uuid, Dexie.minKey], [uuid, Dexie.maxKey], true, true).toArray();
    return states;
};

export const purge = async () => {
  const serviceCount = await db.services.count();
  const statesCount = await db.service_states.count();
  console.log(`Database contains ${serviceCount} service(s) and ${statesCount} states. Beginning purge...`); // eslint-disable-line no-console
  // Delete all data for services whose state hasn't been updated in the last 24 hours
  const threshold = Date.now() - (24 * 60 * 60 * 1000);
  const candidateServices = await db.services.where('startTime').below(threshold).primaryKeys();

  candidateServices.forEach(
    uuid => {
      getServiceStateAt(uuid).then(
        latestState => {
          const latestTimestamp = latestState?.timestamp;

          if (!latestTimestamp || latestTimestamp < threshold) {
            db.service_states.where('uuid').equals(uuid).delete();
            db.services.delete(uuid);
          }
        }
      ).catch(
        e => console.error(e) // eslint-disable-line no-console
      );
    }
  );
};
