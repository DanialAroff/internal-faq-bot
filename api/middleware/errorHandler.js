/**
 * Global Error Handler Middleware
 *
 * This middleware catches all errors thrown in routes and formats them
 * into consistent JSON responses. It's the last middleware in the chain.
 *
 * Error Response Format:
 * {
 *   success: false,
 *   error: {
 *     code: "ERROR_CODE",
 *     message: "Human readable message",
 *     details: {} // optional
 *   }
 * }
 */

/**
 * Custom error class for API errors
 * Use this in routes to throw errors with specific status codes
 *
 * Example usage in routes:
 *   throw new ApiError(404, 'FILE_NOT_FOUND', 'File does not exist in database');
 */
export class ApiError extends Error {
  constructor(statusCode, code, message, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.name = 'ApiError';
  }
}

/**
 * Error handler middleware
 * Express recognizes this as error handler because it has 4 parameters (err, req, res, next)
 *
 * @param {Error} err - The error object
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {Function} next - Next middleware (unused in error handlers)
 */
export function errorHandler(err, req, res, next) {
  // Log the error for debugging (you'll see this in terminal)
  console.error('L Error occurred:');
  console.error('Path:', req.method, req.path);
  console.error('Error:', err.message);
  if (err.stack) {
    console.error('Stack:', err.stack);
  }

  // Default error response
  let statusCode = 500;
  let errorCode = 'INTERNAL_SERVER_ERROR';
  let message = 'An unexpected error occurred';
  let details = null;

  // Handle custom ApiError
  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    errorCode = err.code;
    message = err.message;
    details = err.details;
  }
  // Handle validation errors (from validator middleware)
  else if (err.name === 'ValidationError') {
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
    message = err.message;
    details = err.details || null;
  }
  // Handle database errors (from SQLite)
  else if (err.code === 'SQLITE_ERROR' || err.message.includes('SQLITE')) {
    statusCode = 500;
    errorCode = 'DATABASE_ERROR';
    message = 'Database operation failed';
    details = process.env.NODE_ENV === 'development' ? err.message : null;
  }
  // Handle not found errors
  else if (err.message.includes('not found') || err.message.includes('does not exist')) {
    statusCode = 404;
    errorCode = 'NOT_FOUND';
    message = err.message;
  }
  // Handle file system errors
  else if (err.code === 'ENOENT') {
    statusCode = 404;
    errorCode = 'FILE_NOT_FOUND';
    message = 'File or directory does not exist';
    details = { path: err.path };
  }
  else if (err.code === 'EACCES') {
    statusCode = 403;
    errorCode = 'ACCESS_DENIED';
    message = 'Permission denied to access file';
    details = { path: err.path };
  }
  // Handle JSON parsing errors (malformed request body)
  else if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    statusCode = 400;
    errorCode = 'INVALID_JSON';
    message = 'Invalid JSON in request body';
  }
  // Generic error (keep original message in development)
  else {
    message = process.env.NODE_ENV === 'development'
      ? err.message
      : 'An unexpected error occurred';
  }

  // Send error response
  res.status(statusCode).json({
    success: false,
    error: {
      code: errorCode,
      message: message,
      ...(details && { details }) // Only include details if it exists
    }
  });
}

/**
 * Helper function to create validation errors
 * Use this in validator middleware
 *
 * Example:
 *   throw createValidationError('Missing required field: filePath');
 */
export function createValidationError(message, details = null) {
  const error = new Error(message);
  error.name = 'ValidationError';
  error.details = details;
  return error;
}

/**
 * Async handler wrapper
 * Wraps async route handlers to catch errors and pass them to error handler
 * Without this, you'd need try-catch in every route
 *
 * Usage in routes:
 *   router.get('/search', asyncHandler(async (req, res) => {
 *     // your async code here
 *   }));
 */
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
