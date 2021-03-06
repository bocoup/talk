const Redis = require('ioredis');
const debug = require('debug')('talk:services:redis');
const enabled = require('debug').enabled('talk:services:redis');
const {
  REDIS_URL,
  REDIS_RECONNECTION_MAX_ATTEMPTS,
  REDIS_RECONNECTION_MAX_RETRY_TIME,
  REDIS_RECONNECTION_BACKOFF_FACTOR,
  REDIS_RECONNECTION_BACKOFF_MINIMUM_TIME,
} = require('../config');

const attachMonitors = (client) => {
  debug('client created');

  // Debug events.
  if (enabled) {
    client.on('connect', () => debug('client connected'));
    client.on('ready', () => debug('client ready'));
    client.on('reconnecting', () => debug('client connection lost, attempting to reconnect'));
    client.on('close', () => debug('client closed the connection'));
    client.on('end', () => debug('client ended'));
  }

  // Error events.
  client.on('error', (err) => {
    if (err) {
      console.error('Error connecting to redis:', err);
    }
  });
};

const connectionOptions = {
  retry_strategy: function(options) {
    if (options.error && options.error.code !== 'ECONNREFUSED') {

      debug('retry strategy: none, an error occured');

      // End reconnecting on a specific error and flush all commands with a individual error
      return options.error;
    }
    if (options.total_retry_time > REDIS_RECONNECTION_MAX_RETRY_TIME) {

      debug('retry strategy: none, exhausted retry time');

      // End reconnecting after a specific timeout and flush all commands with a individual error
      return new Error('Retry time exhausted');
    }

    if (options.attempt > REDIS_RECONNECTION_MAX_ATTEMPTS) {

      debug('retry strategy: none, exhausted retry attempts');

      // End reconnecting with built in error
      return undefined;
    }

    // reconnect after
    const delay = Math.max(options.attempt * REDIS_RECONNECTION_BACKOFF_FACTOR, REDIS_RECONNECTION_BACKOFF_MINIMUM_TIME);

    debug(`retry strategy: try to reconnect ${delay} ms from now`);

    return delay;
  }
};

const createClient = () => {
  let client = new Redis(REDIS_URL, connectionOptions);

  // Attach the monitors that will print debug messages to the console.
  attachMonitors(client);

  return client;
};

module.exports = {
  createClient,
  createClientFactory: () => {
    let client = null;

    return () => {
      if (client !== null) {
        return client;
      }

      client = createClient();

      return client;
    };
  }
};
