// Node 23+ removed the legacy `util.is*` type-guards that @tensorflow/tfjs-node still calls.
// require() this BEFORE requiring tfjs-node. Dev-only training tooling; never shipped.
const util = require('util');
const polys = {
  isNullOrUndefined: (v) => v === null || v === undefined,
  isNull: (v) => v === null,
  isUndefined: (v) => v === undefined,
  isArray: Array.isArray,
  isRegExp: (v) => v instanceof RegExp,
  isDate: (v) => v instanceof Date,
  isString: (v) => typeof v === 'string',
  isNumber: (v) => typeof v === 'number',
  isBoolean: (v) => typeof v === 'boolean',
  isFunction: (v) => typeof v === 'function',
  isObject: (v) => typeof v === 'object' && v !== null,
  isPrimitive: (v) => v === null || (typeof v !== 'object' && typeof v !== 'function'),
  isBuffer: Buffer.isBuffer,
  isSymbol: (v) => typeof v === 'symbol',
  isError: (v) => v instanceof Error,
};
for (const [k, fn] of Object.entries(polys)) if (typeof util[k] !== 'function') util[k] = fn;
module.exports = {};
