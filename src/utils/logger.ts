import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Configure logging
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOG_DIR = path.join(__dirname, "../../logs");
const LOG_FILE = path.join(LOG_DIR, `mtender-mcp-${new Date().toISOString().replace(/:/g, '-')}.log`);
const DEBUG_LEVEL = process.env.DEBUG_LEVEL || "info"; // debug, info, warn, error

// Create logs directory if it doesn't exist
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Log level type
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// Log levels
const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// Logger options interface
interface LoggerOptions {
  level?: LogLevel;
  console?: boolean;
  file?: boolean;
}

// Custom type for dynamic timer properties
interface TimerStore {
  [key: string]: number;
}

/**
 * Logger utility for consistent logging
 */
export class Logger implements TimerStore {
  private logLevel: number;
  private logToConsole: boolean;
  private logToFile: boolean;
  private sessionId: string;
  private requestCounter: number;
  [key: string]: any; // For dynamic timer properties

  constructor(options: LoggerOptions = {}) {
    this.logLevel = LOG_LEVELS[options.level || DEBUG_LEVEL as LogLevel] || LOG_LEVELS.info;
    this.logToConsole = options.console !== false;
    this.logToFile = options.file !== false;
    this.sessionId = this.generateSessionId();
    this.requestCounter = 0;
    
    // Log startup information
    this.info("Logger initialized", {
      sessionId: this.sessionId,
      logLevel: Object.keys(LOG_LEVELS)[this.logLevel],
      logFile: LOG_FILE
    });
  }

  generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
  }

  generateRequestId(): string {
    return `req-${++this.requestCounter}-${Date.now()}`;
  }

  formatLogEntry(level: string, message: string, data: Record<string, any> = {}): string {
    const timestamp = new Date().toISOString();
    const dataString = Object.keys(data).length > 0 ? JSON.stringify(data, this.safeStringify()) : '';
    return `[${timestamp}] [${level.toUpperCase()}] [${this.sessionId}] ${message} ${dataString}`;
  }

  // Handle circular references in objects
  safeStringify() {
    const seen = new Set();
    return function(_key: string, value: any) {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return '[Circular Reference]';
        }
        seen.add(value);
      }
      // Truncate long strings
      if (typeof value === 'string' && value.length > 1000) {
        return value.substring(0, 1000) + '... [truncated]';
      }
      return value;
    };
  }

  writeToFile(entry: string): void {
    if (!this.logToFile) return;
    
    try {
      fs.appendFileSync(LOG_FILE, entry + '\n');
    } catch (error: unknown) {
      // Don't use console.error as it might interfere with MCP protocol
      // Instead, try to write the error to a separate error log file
      const errorMessage = error instanceof Error ? error.message : String(error);
      try {
        const ERROR_LOG_FILE = path.join(LOG_DIR, `mtender-mcp-error-${new Date().toISOString().replace(/:/g, '-')}.log`);
        fs.appendFileSync(ERROR_LOG_FILE, `Failed to write to log file: ${errorMessage}\n`);
      } catch {
        // If we can't even write to the error log, there's not much we can do
        // But we shouldn't use console.error as it might interfere with MCP
      }
    }
  }

  writeToConsole(level: string, entry: string): void {
    // Disable console logging completely to avoid any interference with MCP protocol
    // MCP uses stdio for communication, so any console output could potentially
    // interfere with the JSON messages
    return;
    
    // Original implementation (commented out)
    /*
    if (!this.logToConsole) return;
    
    switch(level) {
      case 'error':
        console.error(entry);
        break;
      case 'warn':
        console.warn(entry);
        break;
      case 'info':
        console.info(entry);
        break;
      case 'debug':
      default:
        console.debug(entry);
        break;
    }
    */
  }

  log(level: LogLevel, message: string, data: Record<string, any> = {}): void {
    const logLevelValue = LOG_LEVELS[level];
    
    if (logLevelValue >= this.logLevel) {
      const entry = this.formatLogEntry(level, message, data);
      this.writeToFile(entry);
      this.writeToConsole(level, entry);
    }
  }

  debug(message: string, data: Record<string, any> = {}): void {
    this.log('debug', message, data);
  }

  info(message: string, data: Record<string, any> = {}): void {
    this.log('info', message, data);
  }

  warn(message: string, data: Record<string, any> = {}): void {
    this.log('warn', message, data);
  }

  error(message: string, data: Record<string, any> = {}): void {
    this.log('error', message, data);
  }

  // Create a child logger with request context
  child(requestId?: string): Logger {
    const childLogger = Object.create(this) as Logger;
    childLogger.requestId = requestId || this.generateRequestId();
    
    // Override log methods to include request ID
    const originalLog = childLogger.log;
    childLogger.log = function(level: LogLevel, message: string, data: Record<string, any> = {}) {
      data.requestId = this.requestId;
      originalLog.call(this, level, message, data);
    };
    
    return childLogger;
  }

  // Log timing information
  time(label: string): void {
    this[`timer_${label}`] = Date.now();
  }

  timeEnd(label: string, message: string = ''): number | undefined {
    const timerKey = `timer_${label}`;
    const startTime = this[timerKey] as number | undefined;
    
    if (!startTime) {
      this.warn(`Timer '${label}' does not exist`);
      return;
    }
    
    const duration = Date.now() - startTime;
    this.debug(`${message} ${label}: ${duration}ms`, { duration, label });
    delete this[timerKey];
    return duration;
  }
}

// Create and export a default logger instance
export const logger = new Logger();