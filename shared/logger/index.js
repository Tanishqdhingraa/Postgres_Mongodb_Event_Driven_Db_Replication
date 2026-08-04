const winston = require('winston');

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  process.env.NODE_ENV === 'production'
    ? winston.format.json()
    : winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, stack, ...metadata }) => {
          let log = `[${timestamp}] ${level}: ${message}`;
          if (stack) {
            log += `\n${stack}`;
          }
          if (Object.keys(metadata).length > 0 && metadata.service) {
            log += ` (service: ${metadata.service})`;
          }
          return log;
        })
      )
);

const createLogger = (serviceName) => {
  return winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    defaultMeta: { service: serviceName },
    transports: [
      new winston.transports.Console({
        format: logFormat
      })
    ]
  });
};

module.exports = createLogger;
