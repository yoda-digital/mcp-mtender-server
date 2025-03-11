import { logger } from "../utils/logger.js";

export async function streamToBuffer(stream: any): Promise<Buffer> {
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

// Track active requests
let activeRequestsCount = 0;

/**
 * Create a wrapped handler with logging
 */
export function createLoggingHandler<T, U>(
  methodName: string,
  handler: (request: T) => Promise<U>
): (request: T) => Promise<U> {
  return async (request: T) => {
    // Track active requests
    activeRequestsCount++;
    
    const requestId = `req-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const requestLogger = logger.child(requestId);
    
    // Validate the incoming request
    validateAndLogJson(request, `${methodName}_REQUEST`);
    
    // Start timing
    const startTime = Date.now();
    
    // Ensure params is an object, not a string
    let safeParams;
    try {
      // Use type assertion to access params property
      const req = request as any;
      if (req && req.params && typeof req.params === 'string') {
        // Try to parse the string params into an object
        safeParams = JSON.parse(req.params);
        // Replace the string params with the parsed object
        req.params = safeParams;
      }
    } catch (error) {
      // Log the error but continue with the original params
      requestLogger.warn(`Failed to parse params string to object: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    requestLogger.info(`Handling ${methodName} request`, {
      method: methodName,
      // Safely stringify params for logging (limited to avoid huge logs)
      params: JSON.stringify(request).substring(0, 500) + (JSON.stringify(request).length > 500 ? '...[truncated]' : '')
    });
    
    try {
      // Execute the original handler
      const result = await handler(request);
      
      // Validate the JSON before returning it
      validateAndLogJson(result, `${methodName}_RESPONSE`);
      
      // Log success
      const duration = Date.now() - startTime;
      const resultString = JSON.stringify(result);
      requestLogger.info(`Successfully handled ${methodName} request`, {
        method: methodName,
        duration,
        resultSize: resultString.length,
        resultPreview: resultString.substring(0, 200) + (resultString.length > 200 ? '...[truncated]' : '')
      });
      
      // Decrement active requests counter
      activeRequestsCount--;
      
      return result;
    } catch (error: unknown) {
      // Log error
      const duration = Date.now() - startTime;
      requestLogger.error(`Error handling ${methodName} request`, {
        method: methodName,
        duration,
        error: error instanceof Error ? { message: error.message, stack: error.stack } : String(error)
      });
      
      // Decrement active requests counter
      activeRequestsCount--;
      
      // Rethrow to maintain original behavior
      throw error;
    }
  };
}

/**
 * Function to validate JSON before sending
 * This will help diagnose JSON formatting issues
 */
export function validateAndLogJson(data: any, label: string): void {
  try {
    // First convert to string if it's not already
    const jsonString = typeof data === 'string' ? data : JSON.stringify(data);
    
    // Try to parse it to validate
    JSON.parse(jsonString);
    
    // If we get here, the JSON is valid
    debugLogRawMessage(`VALID_JSON_${label}`, jsonString);
  } catch (error) {
    // Log the invalid JSON and the error
    const errorMessage = error instanceof Error ? error.message : String(error);
    debugLogRawMessage(`INVALID_JSON_${label}`,
      `Error: ${errorMessage}\nData: ${typeof data === 'string' ? data : JSON.stringify(data, null, 2)}`
    );
  }
}

/**
 * Debug function to safely log raw messages
 */
export function debugLogRawMessage(label: string, message: string): void {
  try {
    // Import fs and path here to avoid circular dependencies
    import('fs').then(fs => {
      import('path').then(path => {
        // Get the LOG_DIR from the logger module
        const LOG_DIR = path.join(process.cwd(), 'logs');
        
        // Write to a special debug log file
        const DEBUG_LOG_FILE = path.join(LOG_DIR, `mtender-mcp-raw-debug.log`);
        fs.appendFileSync(
          DEBUG_LOG_FILE,
          `[${new Date().toISOString()}] ${label}: ${message}\n`
        );
      });
    }).catch(() => {
      // Silently fail
    });
  } catch {
    // Silently fail
  }
}

// Export the active requests count for monitoring
export { activeRequestsCount };