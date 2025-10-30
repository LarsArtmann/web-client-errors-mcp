import { getLogger, configure } from '@logtape/logtape';
import { getConfig } from './config.js';

// Configure LogTape for structured logging
export function initializeLogging() {
  const config = getConfig();
  
  if (!config.logging.structured) {
    // Fallback to console logging
    return;
  }

  configure({
    sinks: {
      console: (record: any) => {
        const timestamp = new Date().toISOString();
        const level = record.level.toUpperCase();
        const category = record.category;
        
        if (config.logging.redactSensitiveData && record.context) {
          record.context = redactSensitiveData(record.context);
        }
        
        const message = `[${timestamp}] ${level} ${category}: ${record.message}`;
        
        if (record.context && Object.keys(record.context).length > 0) {
          console.log(`${message} ${JSON.stringify(record.context)}`);
        } else {
          console.log(message);
        }
      }
    },
    loggers: [
      {
        category: 'web-client-errors-mcp',
        sinks: ['console'],
        lowestLevel: config.logging.level as any
      }
    ]
  });
}

export function getAppLogger(category: string = 'main') {
  const config = getConfig();
  
  if (!config.logging.structured) {
    // Simple console fallback with redaction
    return {
      info: (message: string, context?: any) => {
        const ctx = config.logging.redactSensitiveData ? redactSensitiveData(context) : context;
        console.log(`INFO: ${message}`, ctx || '');
      },
      warn: (message: string, context?: any) => {
        const ctx = config.logging.redactSensitiveData ? redactSensitiveData(context) : context;
        console.warn(`WARN: ${message}`, ctx || '');
      },
      error: (message: string, context?: any) => {
        const ctx = config.logging.redactSensitiveData ? redactSensitiveData(context) : context;
        console.error(`ERROR: ${message}`, ctx || '');
      },
      debug: (message: string, context?: any) => {
        const ctx = config.logging.redactSensitiveData ? redactSensitiveData(context) : context;
        console.debug(`DEBUG: ${message}`, ctx || '');
      }
    };
  }
  
  return getLogger(category);
}

// Redact sensitive data from logs
function redactSensitiveData(data: any): any {
  if (!data || typeof data !== 'object') return data;
  
  const sensitiveFields = [
    'password', 'token', 'secret', 'key', 'auth', 
    'authorization', 'cookie', 'session', 'csrf'
  ];
  
  const redacted = { ...data };
  
  function redactValue(obj: any): any {
    if (Array.isArray(obj)) {
      return obj.map(redactValue);
    }
    
    if (obj && typeof obj === 'object') {
      const result: any = {};
      for (const [key, value] of Object.entries(obj)) {
        const lowerKey = key.toLowerCase();
        if (sensitiveFields.some(field => lowerKey.includes(field))) {
          result[key] = '[REDACTED]';
        } else if (typeof value === 'object') {
          result[key] = redactValue(value);
        } else {
          result[key] = value;
        }
      }
      return result;
    }
    
    return obj;
  }
  
  return redactValue(redacted);
}

export default getAppLogger;