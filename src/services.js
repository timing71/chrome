import Dexie from "dexie";

if (typeof(window) !== 'undefined') {
  console.error( // eslint-disable-line no-console
    'services.js is being included from web-side code (window is defined). DB ' +
    'access is only possible from extension-side code.'
  );
}

const db = new Dexie('timing71_services');

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

db.version(5).stores({
  transient_data: 'uuid'
});

db.version(6).stores({
  service_states: '[uuid+timestamp], [uuid+sessionIndex], [uuid+sessionIndex+timestamp], uuid, timestamp',
  service_analyses: 'uuid, [uuid+sessionIndex]'
});

export const listServices = async () => {
  const services = await db.services.toArray();

  return await Promise.all(
    services.map(
      async s => {
        const maxSessionIndex = s.currentSessionIndex;

        if (maxSessionIndex === undefined) {
          const state = await getServiceStateAt(s.uuid);
          return {
            ...s,
            sessions: [state?.state]
          };
        }
        else {
          const sessions = [];

          for (let idx = 0; idx <= maxSessionIndex; idx++) {
            const state = await getSessionStateAt(s.uuid, idx);
            sessions.push(state?.state);
          }

          return {
            ...s,
            sessions
          };
        }
      }
    )
  );
};

export const startService = async (uuid, source) => {
  const ts = Date.now();
  await db.services.put({
    uuid,
    currentSessionIndex: 0,
    source,
    startTime: ts
  });
  await db.service_analyses.put({
    uuid,
    sessionIndex: 0,
    state: {},
    timestamp: ts
  });
};

const getServiceStateAt = (uuid, timestamp=null) => {
  return db.service_states
  .where('[uuid+timestamp]')
  .between([uuid, Dexie.minKey], [uuid, timestamp || Dexie.maxKey], true, true)
  .last();
};

export const getSessionStateAt = (uuid, sessionIndex, timestamp=null) => {
  return db.service_states
  .where('[uuid+sessionIndex+timestamp]')
  .between(
    [uuid, sessionIndex, Dexie.minKey],
    [uuid, sessionIndex, timestamp || Dexie.maxKey],
    true,
    true
  )
  .last();
};

export const getAnalysisAtIndex = (uuid, sessionIndex) => db.service_analyses.get({ uuid, sessionIndex });

export const fetchService = async (uuid, timestamp=null) => {
  const service = await db.services.get(uuid);
  const state = await getServiceStateAt(uuid, timestamp);
  const analysis = await db.service_analyses.get({ uuid, sessionIndex: state?.currentSessionIndex || 0 });
  const transient_data = await db.transient_data.get(uuid);

  return {
    analysis,
    service,
    state: state?.state,
    transient_data
  };
};

export const updateServiceState = async (uuid, sessionIndex, state, timestamp=null) => {
  const myTimestamp = timestamp || Date.now();
  await db.service_states.put({
    uuid,
    sessionIndex,
    state,
    timestamp: myTimestamp
  }, [uuid, myTimestamp]);

  await db.services.update(uuid, { currentSessionIndex: sessionIndex });
};

export const updateServiceAnalysis = async (uuid, sessionIndex, state, timestamp=null) => {
  const myTimestamp = timestamp || Date.now();
  await db.service_analyses.put({
    uuid,
    sessionIndex,
    state,
    timestamp: myTimestamp
  });
};

export const saveTransientData = async (uuid, data) => {
  await db.transient_data.put({ uuid, data });
};

export const getAllServiceStates = async (uuid, sessionIndex) => {
  const states = await db.service_states
    .where('[uuid+sessionIndex+timestamp]')
    .between([uuid, sessionIndex, Dexie.minKey], [uuid, sessionIndex, Dexie.maxKey], true, true);
    return states;
};

export const deleteService = (uuid) => {
  return Promise.all([
    db.service_states.where('uuid').equals(uuid).delete(),
    db.service_analyses.delete(uuid),
    db.transient_data.delete(uuid),
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
