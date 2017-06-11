import moment from 'moment'
import axios from 'axios'
import _ from 'lodash'

const DEFAULT_BASE_URL = 'http://localhost:8096';

/**
 * LogLevel constants for requesting logs
 *
 * @type {{Debug: string, Info: string, Warn: string, Error: string}}
 */
export const LogLevel = {
  Debug: 'debug',
  Info: 'info',
  Warn: 'warn',
  Error: 'error'
};

/**
 * StatType constants for requesting stats
 *
 * @type {{Temperature: string, Humidity: string, Water: string, Fan: string}}
 */
export const StatType = {
  Temperature: 'temperature',
  Humidity: 'humidity',
  Water: 'water',
  Fan: 'fan'
};

/**
 * Direct Greenhouse API client.
 */
export class GreenhouseApi {

  /**
   * Create a new GreenhouseApi instance that will connect at the given base URL
   *
   * @param baseUrl {string} base url for all requests. Should include the scheme, host, and optional port and path.
   */
  constructor(baseUrl = DEFAULT_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * Fetch the status of the greenhouse.
   *
   * @returns {Promise}
   */
  status() {
    return axios.get(this.baseUrl + '/status')
      .then(response => {
        return response.data;
      })
  }

  /**
   * Fetch logs that are at least of the given level for a date range
   *
   * @param logLevel {string} minimum log level to fetch
   * @param start {moment|string|Date} start date
   * @param end {moment|string|Date}  end date
   * @returns {Promise}
   */
  logs(logLevel, start, end) {
    start = moment(start).format();
    end = moment(end).format();
    return axios.get(this.baseUrl + `/logs/${logLevel}/${start}/${end}`)
      .then(response => {
        response.data.items.forEach((item) => {
          item.when = moment(item.when);
        });
        return response.data.items.reverse();
      });
  }

  /**
   * Fetch statistics for a given stat for a date range
   *
   * @param stat {string} statistic whose history to fetch
   * @param start {moment|string|Date} start date
   * @param end {moment|string|Date}  end date
   * @returns {Promise}
   */
  history(stat, start, end) {
    start = moment(start).format();
    end = moment(end).format();
    return axios.get(this.baseUrl + `/${stat}/history/${start}/${end}`)
      .then(response => {
        response.data.items.forEach(item => {
          item.when = moment(item.when);
        });
        return response.data.items.reverse();
      })
  }

  /**
   * Fetch the latest value and when it was recorded from the system
   *
   * @param stat {string} statistic whose history to fetch
   * @returns {Promise}
   */
  latest(stat) {
    return axios.get(this.baseUrl + `/${stat}/latest`)
      .then(response => {
        return response.data;
      })
  }

}

/**
 * For date-range based 'fetches', this caches already-fetched
 * results and will append new results to the cache.
 */
class DateLookupCache {

  /**
   * Create a new DateLookupCache
   *
   * @param initialTimeAgoDays {int} how long ago to fetch, initially
   * @param getter {function(moment, moment)} to call to look up the next set of results
   */
  constructor(initialTimeAgoDays, getter) {
    // fn(start, end) to call to look up the next set of results
    this.getter = getter;

    // how long ago to fetch, initially
    this.initialTimeAgoDays = initialTimeAgoDays;

    // last end-time for which data was fetched. used as the starting point
    this.lastEndTime = null;

    // results cache
    this.cache = [];

    // currently active fetch
    this.currentFetch = new Promise((resolve) => resolve(null));
  }

  /**
   * Fetch the next set of data, waiting for any current requests to also be fulfilled
   *
   * @returns {Promise}
   */
  fetch() {
    return this.currentFetch = this.currentFetch
      .then(() => {
        return this.fetchNow();
      });
  }

  /**
   * Fetch the next set of data immediately
   *
   * @returns {Promise}
   */
  fetchNow() {
    // noinspection JSDeprecatedSymbols
    // noinspection JSCheckFunctionSignatures
    const start = this.lastEndTime === null ? moment().subtract(this.initialTimeAgoDays, 'days') : this.lastEndTime;
    const end = moment();
    this.lastEndTime = end;

    // Optimization: If the two dates are functionally
    // equivalent, simply return our current cache.
    if (start.format() === end.format()) {
      return new Promise((resolve) => {
        resolve(this.cache);
      });
    }

    return this.getter(start, end)
      .then((data) => {
        // save the new data to our cache
        this.cache = this.cache.concat(data);
        return this.cache;
      })
  }

}

const DEFAULT_STAT_LOOKUP_DAYS = 7;
const DEFAULT_LOG_LOOKUP_DAYS = 7;
const DEFAULT_LOG_LEVEL = LogLevel.Info;

/**
 * Greenhouse is an Api client that keeps a running history of
 * logs and stats.
 */
export class Greenhouse {

  /**
   * Create a new "Greenhouse" api client.
   *
   * @param options options override
   */
  constructor(options) {
    options = _.defaults(options || {}, {
      baseUrl: DEFAULT_BASE_URL,
      statDays: DEFAULT_STAT_LOOKUP_DAYS,
      logLevel: DEFAULT_LOG_LEVEL,
      logDays: DEFAULT_LOG_LOOKUP_DAYS
    });

    // the api used to pull in greenhouse data
    this.api = new GreenhouseApi(options.baseUrl);

    // prime our caches
    this.resetLogHistory(options.logLevel, options.logDays);
    this.resetStatHistory(options.statDays);
  }

  /**
   * Build a DateLookupCache for a particular stat
   * @param lookupDays {int} the number of days to fill the cache with
   * @param stat {string} stat for which this cache should be build
   * @returns {DateLookupCache}
   * @private
   */
  _statCache(lookupDays, stat) {
    return new DateLookupCache(lookupDays, (start, end) => {
      return this.api.history(stat, start, end);
    })
  }

  /**
   * Reset the cached log history in order to fetch logs of a different
   * level and set the duration, in days to fetch initially
   *
   * @param logLevel {string} log level to look up
   * @param lookupDays {int} number of days to fetch initially
   */
  resetLogHistory(logLevel, lookupDays) {
    this._logs = new DateLookupCache(lookupDays, (start, end) => {
      return this.api.logs(logLevel, start, end);
    });
  }

  /**
   * Reset the cached statistical history and set the duration, in days to fetch initially
   *
   * @param lookupDays {int} number of days to fetch initially
   */
  resetStatHistory(lookupDays) {
    this._temperature = this._statCache(lookupDays, StatType.Temperature);
    this._humidity = this._statCache(lookupDays, StatType.Humidity);
    this._fan = this._statCache(lookupDays, StatType.Fan);
    this._water = this._statCache(lookupDays, StatType.Water);
  }

  /**
   * Fetch the status of the Greenhouse
   *
   * @returns {Promise}
   */
  status() {
    return this.api.status()
  }

  /**
   * Fetch the latest value and when it was recorded from the system
   *
   * @param stat {string} statistic whose history to fetch
   * @returns {Promise}
   */
  latest(stat) {
    return this.api.latest(stat);
  }

  /**
   * Fetch the latest logs
   *
   * @returns {Promise}
   */
  logs() {
    return this._logs.fetch();
  }

  /**
   * Fetch humidity stats
   *
   * @returns {Promise}
   */
  humidity() {
    return this._humidity.fetch();
  }

  /**
   * Fetch temperature stats
   *
   * @returns {Promise}
   */
  temperature() {
    return this._temperature.fetch();
  }

  /**
   * Fetch fan stats
   *
   * @returns {Promise}
   */
  fan() {
    return this._fan.fetch();
  }

  /**
   * Fetch water stats
   *
   * @returns {Promise}
   */
  water() {
    return this._water.fetch();
  }

}
