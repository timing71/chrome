const URL_ROOT = process.env.NODE_ENV === 'production' ? 'https://beta.timing71.org' : 'http://localhost:3000';

export const createStartURL = (source) => (`${URL_ROOT}/start?source=${source}`);
