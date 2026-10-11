/**
 * Wraps an async route handler or middleware to eliminate repetitive try-catch blocks.
 * Passes any thrown error directly to Express next(err).
 *
 * @param {Function} fn - Async controller function (req, res, next)
 * @returns {Function} Express middleware handler
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = asyncHandler;