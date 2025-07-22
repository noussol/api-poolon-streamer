// logger.js
const { createLogger, format, transports } = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');

const logger = createLogger({
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

logger.log = (...args) => {
    logger.info(...args);
};

module.exports = logger;
