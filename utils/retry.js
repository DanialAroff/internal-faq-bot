/**
 * Retry utility for handling transient failures in API calls
 * Implements exponential backoff strategy
 */

const MAX_RETRIES = parseInt(process.env.MAX_RETRIES) || 3;
const RETRY_DELAY_MS = parseInt(process.env.RETRY_DELAY_MS) || 1000;

/**
 * Sleep for specified milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry a fetch request with exponential backoff
 *
 * @param {Function} fetchFn - Function that returns a fetch promise
 * @param {Object} options - Retry options
 * @param {number} options.maxRetries - Maximum retry attempts (default: 3)
 * @param {number} options.delayMs - Initial delay in ms (default: 1000)
 * @param {boolean} options.exponentialBackoff - Use exponential backoff (default: true)
 * @param {Function} options.onRetry - Callback on retry (optional)
 * @returns {Promise<Response>} - The fetch response
 * @throws {Error} - After all retries exhausted
 *
 * @example
 * const response = await fetchWithRetry(() =>
 *   fetch('https://api.example.com', { method: 'POST', body: data })
 * );
 */
export async function fetchWithRetry(fetchFn, options = {}) {
  const {
    maxRetries = MAX_RETRIES,
    delayMs = RETRY_DELAY_MS,
    exponentialBackoff = true,
    onRetry = null
  } = options;

  let lastError;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetchFn();

      // Success: HTTP 2xx
      if (response.ok) {
        return response;
      }

      // Server errors (5xx) - retry
      if (response.status >= 500) {
        throw new Error(`Server error: ${response.status} ${response.statusText}`);
      }

      // Rate limiting (429) - retry with longer delay
      if (response.status === 429) {
        throw new Error(`Rate limit exceeded (429)`);
      }

      // Client errors (4xx) - don't retry, return immediately
      if (response.status >= 400) {
        console.error(`❌ Client error ${response.status}, not retrying`);
        return response; // Let caller handle the error response
      }

      return response;

    } catch (err) {
      lastError = err;

      // Don't retry on JSON parse errors (indicates invalid response)
      if (err.name === 'SyntaxError') {
        throw err;
      }

      // Last attempt - don't wait, just throw
      if (attempt >= maxRetries - 1) {
        break;
      }

      // Calculate delay with exponential backoff
      const delay = exponentialBackoff
        ? delayMs * Math.pow(2, attempt)  // 1s, 2s, 4s, 8s...
        : delayMs;                         // Fixed delay

      console.warn(`⚠️  Attempt ${attempt + 1}/${maxRetries} failed: ${err.message}`);
      console.warn(`   Retrying in ${delay}ms...`);

      // Call retry callback if provided
      if (onRetry) {
        onRetry(attempt + 1, err, delay);
      }

      await sleep(delay);
    }
  }

  // All retries exhausted
  throw new Error(`Failed after ${maxRetries} attempts: ${lastError.message}`);
}

/**
 * Simpler retry wrapper for async operations (not just fetch)
 * Useful for database operations, file I/O, etc.
 *
 * @param {Function} operation - Async function to retry
 * @param {Object} options - Retry options (same as fetchWithRetry)
 * @returns {Promise<any>} - Result of the operation
 *
 * @example
 * const data = await retryOperation(
 *   async () => await db.run("INSERT INTO ..."),
 *   { maxRetries: 5 }
 * );
 */
export async function retryOperation(operation, options = {}) {
  const {
    maxRetries = MAX_RETRIES,
    delayMs = RETRY_DELAY_MS,
    exponentialBackoff = true,
    onRetry = null
  } = options;

  let lastError;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();

    } catch (err) {
      lastError = err;

      // Last attempt - don't wait
      if (attempt >= maxRetries - 1) {
        break;
      }

      const delay = exponentialBackoff
        ? delayMs * Math.pow(2, attempt)
        : delayMs;

      console.warn(`⚠️  Operation attempt ${attempt + 1}/${maxRetries} failed: ${err.message}`);
      console.warn(`   Retrying in ${delay}ms...`);

      if (onRetry) {
        onRetry(attempt + 1, err, delay);
      }

      await sleep(delay);
    }
  }

  throw new Error(`Operation failed after ${maxRetries} attempts: ${lastError.message}`);
}
