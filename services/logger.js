// logger.js
const { createLogger, format, transports } = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');

const _logger = createLogger({
    level: global.sharedConfig.logLevel,
    format: format.combine(
        format.timestamp(),
        format.printf(({ level, message, timestamp, }) => {
            return `[${timestamp}] ${level.toUpperCase()}: ${message}`;
        })
    ),
    transports: [
        new DailyRotateFile({
            filename: 'logs/api-poolon-%DATE%.log',
            datePattern: 'YYYYMMDD',
            zippedArchive: true, // Compress old logs
            maxSize: '20m', // Maximum size of a single log file
            maxFiles: '90d', // Keep logs for 14 days
        })
    ]
});

_logger.log = (...args) => {
    _logger.info(...args);
};

const logger = {
    info: (...args) => _logger.info(args.join(' ')),
    warn: (...args) => _logger.warn(args.join(' ')),
    error: (...args) => _logger.error(args.join(' ')),
    debug: (...args) => _logger.debug(args.join(' ')),
    log: (...args) => _logger.log(args.join(' ')),
    setLogLevel: (level) => {
        _logger.level = level;
    }
}

module.exports = logger;
