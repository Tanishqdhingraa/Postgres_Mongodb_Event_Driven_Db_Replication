/**
 * Common utility helper functions
 */

/**
 * Promisified timeout
 * @param {number} ms 
 * @returns {Promise<void>}
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Clean data object by removing undefined keys
 * @param {Object} obj 
 * @returns {Object}
 */
const cleanObject = (obj) => {
  const newObj = { ...obj };
  Object.keys(newObj).forEach((key) => {
    if (newObj[key] === undefined) {
      delete newObj[key];
    }
  });
  return newObj;
};

module.exports = {
  sleep,
  cleanObject
};
