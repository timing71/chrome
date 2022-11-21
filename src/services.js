import Dexie from "dexie";

const db = new Dexie('timing71_services');

const DEFAULT_ANALYSIS_STATE = {
  version: 2
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

db.version(4).stores({
  services: 'uuid,startTime',
  service_states: '[uuid+timestamp], uuid, timestamp',
  service_analyses: 'uuid'
});

export const listServices = async () => {
  const services = await db.services.toArray();

  await Promise.all(
    services.map(
      async s => {
        const state = await getServiceStateAt(s.uuid);
        s.state = state?.state;
      }
    )
  );

  return services;
};

export const listServiceSources = async () => {
  const services = await db.services.orderBy('startTime').reverse().toArray();
  return [...new Set(services.map(s => s.source))];
};

export const startService = async (uuid, source) => {
  const ts = Date.now();
  await db.services.put({
    uuid,
    source,
    startTime: ts
  });
  await db.service_analyses.put({
    uuid,
    state: {  ...DEFAULT_ANALYSIS_STATE },
    timestamp: ts
  });
};

export const terminateService = async (uuid) => {
  await db.services.delete(uuid);
  await db.service_states.delete(uuid);
  await db.service_analyses.delete(uuid);
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
  const analysis = await db.service_analyses.get(uuid);
  return {
    analysis,
    service,
    state: state?.state
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

export const updateServiceAnalysis = async (uuid, state, timestamp=null) => {
  const myTimestamp = timestamp || Date.now();
  await db.service_analyses.put({
    uuid,
    state,
    timestamp: myTimestamp
  });
};


export const getAllServiceStates = async (uuid) => {
  const states = await db.service_states
    .where('[uuid+timestamp]')
    .between([uuid, Dexie.minKey], [uuid, Dexie.maxKey], true, true);
    return states;
};

export const deleteService = (uuid) => {
  return Promise.all([
    db.service_states.where('uuid').equals(uuid).delete(),
    db.service_analyses.delete(uuid),
    db.services.delete(uuid)
  ]);
};

export const purge = () => {
  return db.transaction(
    'rw!',
    [db.services, db.service_states, db.service_analyses],
    async () => {
      const serviceCount = await db.services.count();
      const statesCount = await db.service_states.count();

      console.log(`Database contains ${serviceCount} service(s) and ${statesCount} states. Beginning purge...`); // eslint-disable-line no-console

      // Delete all data for services whose state hasn't been updated in the last 7 days
      const threshold = Date.now() - (7 * 24 * 60 * 60 * 1000);
      const candidateServices = await db.services.where('startTime').below(threshold).primaryKeys();

      if (process.env.NODE_ENV !== 'production') {
        console.log(`Purging is disabled as NODE_ENV is ${process.env.NODE_ENV}`); // eslint-disable-line no-console
      }
      else {
        candidateServices.forEach(
          uuid => {
            getServiceStateAt(uuid).then(
              latestState => {
                const latestTimestamp = latestState?.timestamp;

                if (!latestTimestamp || latestTimestamp < threshold) {
                  deleteService(uuid);
                }
              }
            ).catch(
              e => console.error(e) // eslint-disable-line no-console
            );
          }
        );
      }

      // In any case tidy up orphans
      const knownServiceIDs = await db.services.toCollection().primaryKeys();

      let orphans = -1 ;

      while (orphans !== 0) {
        // Chunk into 1000s to prevent OOMing with large orphan sets
        orphans = await db.service_states.where('uuid').noneOf(knownServiceIDs).limit(1000).delete();
        if (orphans > 0) {
          console.log(`Removed ${orphans} orphaned states`); // eslint-disable-line no-console
        }
      }
    }
  );
};
