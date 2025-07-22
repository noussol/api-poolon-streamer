const jwt = require('jsonwebtoken');
const JWT_SECRET = global.sharedConfig.JWT_SECRET;

const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');

const ffprobeStatic = require('@ffprobe-installer/ffprobe');
const fs = require('fs');
const path = require('path');

ffmpeg.setFfmpegPath(ffmpegInstaller.path);
ffmpeg.setFfprobePath(ffprobeStatic.path);

exports.sleep = async (ms) => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve(true)
    }, ms);
  })
}

exports.humanFileSize = (bytes) => {
  const thresh = 1024;
  if (Math.abs(bytes) < thresh) {
    return bytes + ' B';
  }
  const units = ['KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  let u = -1;
  do {
    bytes /= thresh;
    ++u;
  } while (Math.abs(bytes) >= thresh && u < units.length - 1);
  return bytes.toFixed(1) + ' ' + units[u];
}

exports.genrateThumbnails = async (videoPath, videoName, thumbnailsPath) => {
  return new Promise(async (resolve, reject) => {
    try {

      const metadata = await new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (err, metadata) => {
              if (err) reject(err);
              else resolve(metadata);
          });
      });

      const duration = metadata.format.duration;
      const screenshotTime = Math.floor(duration / 3);

      // Take a screenshot
      await new Promise((resolve, reject) => {
          ffmpeg(videoPath)
              .screenshots({
                  timestamps: [screenshotTime],
                  filename: `${videoName}.jpg`,
                  folder: thumbnailsPath,
                  size: '640x360',
              })
              .on('end', () => resolve())
              .on('error', (err) => reject(err));
      });
      resolve({ok: true, thumbnailPath: `${thumbnailsPath}/${videoName}.jpg`});
    } catch (error) {
      reject(`Error generating thumbnail for video ${videoPath}: ${error}`);
    }
  })
}

exports.isValidToken = (req, res, next) => {
  const token = req.headers['authorization'];

  if (!token) {
    console.warn('Missing token in request.');
    return res.status(401).json({ error: 'Not allowed' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.decoded = decoded; // facultatif : stocker l’user décodé pour l’utiliser après
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      console.warn('Token expired.');
      return res.status(401).json({ error: 'Token expired' });
    } else if (error instanceof jwt.JsonWebTokenError) {
      console.warn('Invalid token.');
      return res.status(401).json({ error: 'Invalid token' });
    }

    console.error('Unexpected JWT error:', error);
    return res.status(500).json({ error: 'Failed to authenticate token' });
  }
};

exports.runLogsRetention = (retentionDays = 30) => {
  const baseLogsDir = global.sharedConfig?.devicesLogsPath;
  const now = Date.now();
  const deletedFiles = [];

  if (!fs.existsSync(baseLogsDir)) {
    console.warn('[LogsRetention] Base logs directory not found:', baseLogsDir);
    return;
  }

  try {
    const deviceDirs = fs.readdirSync(baseLogsDir).filter((name) => {
      const devicePath = path.join(baseLogsDir, name);
      return fs.statSync(devicePath).isDirectory();
    });

    for (const deviceDir of deviceDirs) {
      const fullDevicePath = path.join(baseLogsDir, deviceDir);
      const files = fs.readdirSync(fullDevicePath);

      for (const file of files) {
        const filePath = path.join(fullDevicePath, file);
        const stats = fs.statSync(filePath);
        const ageDays = (now - stats.mtimeMs) / (1000 * 60 * 60 * 24);

        if (ageDays > retentionDays) {
          fs.unlinkSync(filePath);
          deletedFiles.push(`${deviceDir}/${file}`);
        }
      }
    }

    console.log(`[LogsRetention] ✅ ${deletedFiles.length} files deleted:\n`, deletedFiles.join('\n'));

  } catch (err) {
    console.error('[LogsRetention] ❌ Error:', err);
  }
}