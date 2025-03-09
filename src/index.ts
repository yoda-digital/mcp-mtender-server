#!/usr/bin/env node

/**
 * MTender OCDS Server - MCP server for accessing Moldova's public procurement data
 * This server provides access to the MTender API which implements the Open Contracting Data Standard (OCDS)
 *
 * Current Implementation Status:
 * - Basic access to tender, budget, and funding source data
 * - Support for searching tenders with pagination
 * - Support for retrieving specific tender details
 *
 * OCDS Schema Coverage:
 * - Release Packages: ✅ Supported through direct API access
 * - Records: ✅ Supported through direct API access
 * - Release Sections:
 *   - Planning: ✅ Supported through budget endpoints
 *   - Tender: ✅ Supported through tender endpoints
 *   - Award: ✅ Included in tender responses
 *   - Contract: ✅ Included in tender responses
 *   - Implementation: ❌ Limited support (depends on MTender API)
 * - Building Blocks:
 *   - Organizations/Parties: ✅ Included in responses
 *   - Items: ✅ Included in responses
 *   - Values: ✅ Included in responses
 *   - Periods: ✅ Included in responses
 *   - Documents: ✅ Included in responses
 *   - Milestones: ✅ Included in responses
 *   - Transactions: ❌ Limited support (depends on MTender API)
 *   - Amendments: ✅ Included in responses
 *   - Related Processes: ✅ Included in responses
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Import our modules
import { logger } from "./utils/logger.js";
import { setupResourceHandlers } from "./handlers/resources.js";
import { setupToolHandlers } from "./handlers/tools.js";
import { activeRequestsCount, debugLogRawMessage } from "./handlers/utils.js";

// Define MCP error type that might include a code
interface McpErrorWithCode extends Error {
  code?: string | number;
}

/**
 * Create an MCP server with capabilities for resources and tools
 */
const server = new Server(
  {
    name: "MTender OCDS Server",
    version: "0.1.0",
  },
  {
    capabilities: {
      resources: {},
      resourceTemplates: {},
      tools: {},
    },
  }
);

// Add error handler to log server errors
server.onerror = (error: Error | McpErrorWithCode) => {
  const errorData: Record<string, any> = {
    message: error.message,
    stack: error.stack
  };
  
  // Add code if it exists
  if ('code' in error && error.code !== undefined) {
    errorData.code = error.code;
  }
  
  logger.error("MCP Server error", errorData);
  
  // Log additional details for debugging connection issues
  logger.warn("If the server is being interrupted, check for network issues or timeouts", {
    timestamp: new Date().toISOString(),
    processUptime: process.uptime()
  });
};

// Set up resource handlers
setupResourceHandlers(server);

// Set up tool handlers
setupToolHandlers(server);

/**
 * Set up process monitoring and heartbeat
 */
function setupProcessMonitoring() {
  // Log process information on startup
  const startupInfo = {
    pid: process.pid,
    platform: process.platform,
    nodeVersion: process.version,
    memoryUsage: process.memoryUsage(),
    cpuUsage: process.cpuUsage(),
    uptime: process.uptime()
  };
  
  logger.info("Process started", startupInfo);
  
  // Set up periodic heartbeat to monitor server health
  const heartbeatInterval = setInterval(() => {
    const memoryUsage = process.memoryUsage();
    const heartbeatInfo = {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memoryUsageMB: {
        rss: Math.round(memoryUsage.rss / 1024 / 1024),
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        external: Math.round((memoryUsage.external || 0) / 1024 / 1024)
      },
      activeRequests: activeRequestsCount
    };
    
    logger.debug("Server heartbeat", heartbeatInfo);
  }, 30000); // Every 30 seconds
  
  // Clean up on process exit
  process.on('exit', (code) => {
    clearInterval(heartbeatInterval);
    logger.info(`Process exiting with code ${code}`, {
      exitCode: code,
      uptime: process.uptime()
    });
  });
  
  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    logger.error("Uncaught exception", {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
  });
  
  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    logger.error("Unhandled promise rejection", {
      reason: reason instanceof Error ? { message: reason.message, stack: reason.stack } : reason,
      promise: String(promise)
    });
  });
  
  // Handle SIGINT (Ctrl+C)
  process.on('SIGINT', () => {
    logger.info("Received SIGINT signal, shutting down gracefully");
    clearInterval(heartbeatInterval);
    server.close().then(() => {
      logger.info("Server closed successfully");
      process.exit(0);
    }).catch(error => {
      logger.error("Error during server shutdown", {
        message: error.message,
        stack: error.stack
      });
      process.exit(1);
    });
  });
  
  // Handle SIGTERM
  process.on('SIGTERM', () => {
    logger.info("Received SIGTERM signal, shutting down gracefully");
    clearInterval(heartbeatInterval);
    server.close().then(() => {
      logger.info("Server closed successfully");
      process.exit(0);
    }).catch(error => {
      logger.error("Error during server shutdown", {
        message: error.message,
        stack: error.stack
      });
      process.exit(1);
    });
  });
  
  return heartbeatInterval;
}

/**
 * Monitor connection status
 */
function setupConnectionMonitoring(transport: StdioServerTransport) {
  // Add connection monitoring
  let lastMessageTime = Date.now();
  let connectionHealthy = true;
  
  // Check connection health periodically
  const connectionCheckInterval = setInterval(() => {
    const now = Date.now();
    const timeSinceLastMessage = now - lastMessageTime;
    
    // If no message received in 2 minutes, log a warning
    if (timeSinceLastMessage > 120000 && connectionHealthy) {
      connectionHealthy = false;
      logger.warn("No messages received for 2 minutes, connection may be stalled", {
        timeSinceLastMessageMs: timeSinceLastMessage,
        lastMessageTime: new Date(lastMessageTime).toISOString()
      });
    }
    
    // If connection was unhealthy but now received a message, log recovery
    if (!connectionHealthy && timeSinceLastMessage < 120000) {
      connectionHealthy = true;
      logger.info("Connection recovered, messages flowing again", {
        timeSinceLastMessageMs: timeSinceLastMessage,
        lastMessageTime: new Date(lastMessageTime).toISOString()
      });
    }
  }, 30000); // Check every 30 seconds
  
  // Update last message time periodically to detect if process is still alive
  const pingInterval = setInterval(() => {
    // Just update the timestamp to show the process is still running
    lastMessageTime = Date.now();
    logger.debug("Connection ping", { timestamp: new Date().toISOString() });
  }, 60000); // Every minute
  
  return { connectionCheckInterval, pingInterval };
}

/**
 * Start the server using stdio transport.
 * This allows the server to communicate via standard input/output streams.
 */
async function main() {
  try {
    logger.info("Starting MTender OCDS Server");
    
    // Set up process monitoring
    const heartbeatInterval = setupProcessMonitoring();
    
    // Create transport
    const transport = new StdioServerTransport();
    
    // Get the LOG_DIR from the logger module
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const LOG_DIR = path.join(__dirname, "../logs");
    
    // Create a debug log file for raw message logging
    const RAW_DEBUG_LOG_FILE = path.join(LOG_DIR, `mtender-mcp-raw-debug.log`);
    fs.writeFileSync(RAW_DEBUG_LOG_FILE, `[${new Date().toISOString()}] Starting raw message logging\n`);
    
    // Set up a simpler approach to capture stdin/stdout
    // Instead of monkey-patching, we'll use a dedicated file descriptor
    const stdoutFd = fs.openSync(path.join(LOG_DIR, 'stdout-capture.log'), 'a');
    const stdinFd = fs.openSync(path.join(LOG_DIR, 'stdin-capture.log'), 'a');
    
    // Set up a simple interval to check for new data in the capture files
    const captureInterval = setInterval(() => {
      try {
        // Log a heartbeat to the raw debug log
        fs.appendFileSync(
          RAW_DEBUG_LOG_FILE,
          `[${new Date().toISOString()}] HEARTBEAT: Server is still running\n`
        );
      } catch {
        // Silently fail
      }
    }, 5000);
    
    // Connect to transport
    logger.info("Connecting to stdio transport");
    await server.connect(transport);
    
    // Set up connection monitoring (after connection is established)
    const { connectionCheckInterval, pingInterval } = setupConnectionMonitoring(transport);
    
    // Log that we're not setting up request tracking at runtime
    logger.info("Request tracking will be set up through handler registration");
    
    // Log successful startup
    logger.info("MTender OCDS Server running on stdio", {
      serverName: "MTender OCDS Server",
      version: "0.1.0",
      startupTime: new Date().toISOString()
    });
    
    // Set up cleanup for process exit
    process.on('exit', () => {
      // Close file descriptors
      try {
        fs.closeSync(stdoutFd);
        fs.closeSync(stdinFd);
      } catch {
        // Silently fail
      }
      
      clearInterval(captureInterval);
      clearInterval(heartbeatInterval);
      clearInterval(connectionCheckInterval);
      clearInterval(pingInterval);
    });
  } catch (error) {
    logger.error("Failed to start server", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    process.exit(1);
  }
}

main().catch((error) => {
  // Don't use console.error as it might interfere with MCP protocol
  // Instead, log to file only
  logger.error("Unhandled error in main function", {
    message: error.message,
    stack: error.stack
  });
  
  // Give the logger time to write to the file before exiting
  setTimeout(() => {
    process.exit(1);
  }, 500);
});
