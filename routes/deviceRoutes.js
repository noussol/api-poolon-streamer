const express = require('express');
const { decryptPassword } = require('../services/helpers');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const logger = require('../services/logger');
const { Op } = require('sequelize');
const { User } = require('../models/userModel');
const { Admin } = require('../models/adminModel');
const { Version } = require('../models/versionModel');
const { sendNewPasswordAdmin, sendCreateAdminMail, sendDeletedAdminMail } = require('../services/mailer');

const { isValidToken } = require('../services/tools');
const { Device } = require('../models/deviceModel');
const { UserDevice } = require('../models/userDeviceModel');
const { DeviceUse } = require('../models/deviceUseModel');
const { Category } = require('../models/categoryModel');
const { Video } = require('../models/videosModel');

const unzipper = require('unzipper');
const path = require('path');
const fs = require('fs');
const uploader = require('../services/uploader');
const archiver = require('archiver');

const JWT_SECRET = global.sharedConfig.JWT_SECRET;

const createNewVersion = async (req, res) => {
  try {
    const { device, android, ios, androidUrl, iosUrl } = req.body;
    if (!device || !ios || !android) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    // Check if a version with the same name already exists
    const existingVersion = await Version.findOne({ where: { device } });
    if (existingVersion) {
      return res.status(409).json({ error: 'Version for this device already exists' });
    }
    // Create the new version
    const newVersion = new Version({device, android, ios, androidUrl, iosUrl});
    await newVersion.save();
    return res.status(201).json(newVersion);
  } catch (error) {
    logger.error('Error creating new version:' + error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const deleteVersion = async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    // Check if a version with the same name already exists
    const existingVersion = await Version.findOne({ where: { id } });
    if (!existingVersion) {
      return res.status(409).json({ error: 'No version found' });
    }
    await existingVersion.destroy();
    logger.warn(`Version with id ${id} deleted by user ${req.decoded.mail}`);
    return res.status(200).json({ message: 'Version deleted successfully' });
  } catch (error) {
    logger.error('Error deletingversion:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const getAllVersions = async (req, res) => {
  try {
    const versions = await Version.findAll({
      order: [['id', 'DESC']],
    });
    return res.status(200).json(versions);
  } catch (error) {
    logger.error('Error fetching versions:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const getAllDevices = async (req, res) => {
  try {
    logger.debug('Fetching all devices');
    const devices = await Device.findAll({limit: 100000, include: ['users', 'mainUser', 'version']});
    // TODO next: calculate some device use and so for device based KPIs
    return res.status(200).json(devices);
  } catch (error) {
    logger.error('Error fetching devices:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const getLastVersion = async (req, res) => {
  try {
    const version = await Version.findOne({
      order: [['id', 'DESC']],
    });
    return res.status(200).json(version);
  } catch (error) {
    logger.error('Error fetching version:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const createNewDevice = async (req, res) => {
  try {
    const { name, active, hash, version, valid_until, mainUser, paiment_ref } = req.body;
    const id_version = version?.id ?? null;
    const main_user = mainUser?.id ?? null;

    if (!name || !hash) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check if a device with the same name already exists
    const existingDevice = await Device.findOne({where:{name}});

    if (existingDevice) {
      return res.status(409).json({ error: 'Device with this name already exists' });
    }

    let valid_untilDate = null;
    if (valid_until && valid_until > 0) {
      const date = new Date();
      date.setTime(date.getTime() + (valid_until * 24 * 60 * 60 * 1000)); // add days to current date if valid_until is provided
      valid_untilDate = date;
    }

    const newDevice = new Device({
      name,
      active: active??false, // Default to true if not provided
      hash,
      id_version,
      valid_until: valid_untilDate, // add days to current date if valid_until is provided
      main_user: main_user || null, // Default to null if not provided
      paiment_ref: paiment_ref || null, // Default to null if not provided
    });
    await newDevice.save();

    return res.status(201).json(newDevice);
  } catch (error) {
    logger.error('Error creating new device:'+ error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const updateDevice = async (req, res) => {
  try {
    const { id, name, active, hash, valid_until, paiment_ref, validUntil, mainUser, users } = req.body;
    const oldValidUntil = valid_until ? Math.floor((((new Date(valid_until)).getTime() - (new Date()).getTime()) / (24*60*60*1000)) +1 ) : null

    if (!id) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check if a device with the same name already exists
    const existingDevice = await Device.findOne({where: {id}, include: ['users']});

    if (!existingDevice) {
      return res.status(409).json({ error: 'Device with this name does not exists' });
    }
    existingDevice.active = active??false;
    existingDevice.name = name ?? null;
    existingDevice.hash = hash ?? null;
    existingDevice.paiment_ref = paiment_ref ?? null;
    existingDevice.main_user = mainUser?.id ?? null;
    
    if(!validUntil){
      existingDevice.valid_until = null; // if old validUntil is provided, but not new one, set valid_until to null (unlimited)
    }else if (validUntil !== oldValidUntil) {
      // if validUntil is provided, but different from old one, set valid_until to new value
      const date = new Date();
      date.setTime(date.getTime() + (validUntil * 24 * 60 * 60 * 1000)); // add days to current date if validUntil is provided
      existingDevice.valid_until = date;
    }

    await existingDevice.save();

    if (users && users.length > 0 && (existingDevice.users?.map(x => x.id)!== users.map(x => x.id))) {
      await UserDevice.destroy({ where: { id_device: existingDevice.id } });
      for (const user of users.filter((item, index, self) => index === self.findIndex((t) => t.id === item.id))) {
        if (user.id) {
          const uDevice = new UserDevice({
            id_user: user.id,
            id_device: existingDevice.id
          })
          await uDevice.save()
        }
      }
    }else{
      // if no users provided, remove all users for this device
      await UserDevice.destroy({ where: { id_device: existingDevice.id } });
    }

    return res.status(201).json(existingDevice);
  } catch (error) {
    logger.error('Error editing new device:' + error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};


const deleteDevice = async (req, res) => {
  const token = req.headers['authorization']
  const { id } = req.body;
  if (!token) {
    logger.error(`tried to deleteDevice with no token. `)
    return res.status(401).json({ error: 'Not allowed' });
  }
  try {
    //decoded is forcely an admin, as users token use other secret
    let decoded = jwt.verify(token, JWT_SECRET);
    const device = await Device.findOne({ where: { id } });
    if (!device) {
        return res.status(401).json({ error: 'Device not found' });
    }
    await UserDevice.destroy({ where: { id_device: device.id } });
    await DeviceUse.destroy({ where: { id_device: device.id } });
    await device.destroy();
    logger.warn(`Device ${device.name} has been deleted by admin ${decoded.mail}`)
    res.status(200).json({ success: true });
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      logger.warn(`deleteDevice an expired token. `);
      return res.status(401).send('Not Allowed')
    } else if (error instanceof jwt.JsonWebTokenError) {
      logger.warn(`deleteDevice an incorrect token. `);
      return res.status(401).send('Not Allowed')
    }
    logger.error(`error while deleteDevice. error was: ${error}`);
    return res.status(500).json({ error: 'Failed to authenticate token' });
  }
};

const setPlayedVideoFromDevice = async (req, res) => {
  const { id_video,id_category,from,connected_to_internet, duration, city, country,ip } = req.body;
  logger.debug(`Setting played video from device with id_video: ${id_video}, id_category: ${id_category}, from: ${from}, duration: ${duration}, connected_to_internet: ${connected_to_internet}, city: ${city}, country: ${country}, ip: ${ip}`);
  if (!id_video || id_category == null || id_category === undefined) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  const { device } = req;
  if (!device) {
    logger.error('Device not found in request headers.');
    return res.status(401).json({ error: 'Not allowed' });
  }

  try {
    // Create a new DeviceUse entry
    const newUse = new DeviceUse({
      id_device: device.id,
      id_video,
      id_category,
      from,
      connected_to_internet: connected_to_internet || false,
      city: city || null,
      country: country || null,
      ip: ip || null,
      duration: duration || null,
    });
    await newUse.save();

    return res.status(201).json(newUse);
  } catch (error) {
    logger.error('Error setting played video from device:' + error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

const setStoppedVideoFromDevice = async (req, res) => {
  const { id_video, id_category, duration } = req.body;
  logger.debug(`Setting stopped video from device with id_video: ${id_video}, id_category: ${id_category}, duration: ${duration}`);
  if (!id_video || id_category == null || id_category == undefined) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  const { device } = req;
  if (!device) {
    logger.error('Device not found in request headers.');
    return res.status(401).json({ error: 'Not allowed' });
  }

  try {
    // Find the last DeviceUse entry for this device and video
    const lastUse = await DeviceUse.findOne({
      where: {
        id_device: device.id,
        id_video,
        id_category,
      },
      order: [['from', 'DESC']] // Get the most recent one
    });
    if (!lastUse) {
      return res.status(404).json({ error: 'No previous use found for this video' });
    }
    // Update the duration of the last use
    lastUse.duration = duration || null; // Set duration to null if not provided
    await lastUse.save();
    
    return res.status(201).json(lastUse);
  } catch (error) {
    logger.error('Error setting played video from device:' + error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

const updateMetasFromDevice = async (req, res) => {
  const { last_connection, last_localization, last_ip, last_city, last_country, current_wifi, used_space, total_space, version } = req.body;

  const { device } = req;
  if (!device) {
    logger.error('Device not found in request headers.');
    return res.status(401).json({ error: 'Not allowed' });
  }

  try {
    // Create a new DeviceUse entry
    await Device.update({
      last_connection: last_connection || null,
      last_localization: last_localization ? { type: 'Point', coordinates: last_localization } : null,
      last_ip: last_ip || null,
      last_city: last_city || null,
      last_country: last_country || null,
      current_wifi: current_wifi || null,
      used_space: used_space || 0,
      total_space: total_space || null,
    }, {
      where: { id: device.id }
    });
    
    if (version) {
      const existingVersion = await Version.findOne({ where: { device: version } });
      if (!existingVersion) {
        return res.status(404).json({ error: 'Version not found' });
      }
      await Device.update({
        id_version: existingVersion.id,
      }, {
        where: { id: device.id }
      });
    }

    return res.status(201).json({'message': 'Device metas updated successfully' });
  } catch (error) {
    logger.error('Error setting played video from device:' + error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

const isValidDeviceHash = async (req, res, next) => {
  const hash = req.headers['hash'];
  const name = req.headers['name'];

  logger.debug(`isValidDeviceHash called with hash: ${hash}, name: ${name} for request: ${req.originalUrl}`);

  if (!hash || !name) {
    logger.warn('Missing hash or name in request headers.');
    return res.status(401).json({ error: 'Not allowed' });
  }
  try {
    const device = await Device.findOne({ where: { hash, name } });
    if (!device) {
      logger.warn(`Device with hash ${hash} and name ${name} not found.`);
      return res.status(401).json({ error: 'Not allowed' });
    }
    req.device = device;
    next();
  } catch (error) {
    console.error('Unexpected JWT error:', error);
    return res.status(500).json({ error: 'Failed to authenticate token' });
  }
};

const getGlobalKpis = async (req, res) => {
  const { days } = req.query;
  let dateCondition = '';
  if (days && !isNaN(days)) {
    const parsedDays = parseInt(days);
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - parsedDays);
    dateCondition = `WHERE \`from\` >= '${fromDate.toISOString().slice(0, 19).replace('T', ' ')}'`;
  }

  try {
    // 1. Total used time (en secondes)
    const [totalDurationResult] = await global.sequelize.query(`
      SELECT SUM(duration) AS total_used_time
      FROM device_uses
      ${dateCondition}
    `);
    const totalUsedTime = totalDurationResult[0].total_used_time || 0;

    // 2. Nombre de jours distincts
    const [distinctDaysResult] = await global.sequelize.query(`
      SELECT COUNT(DISTINCT DATE(\`from\`)) AS days_used
      FROM device_uses
      ${dateCondition}
    `);
    const daysUsed = distinctDaysResult[0].days_used || 0;
    const avgPerDay = daysUsed > 0 ? (totalUsedTime / daysUsed).toFixed(2) : 0; // En minutes

    // 3. Top 3 vidéos jouées (catégorie ≠ 0)
    const [topVideosResult] = await global.sequelize.query(`
      SELECT id_video, COUNT(*) as play_count
      FROM device_uses
      WHERE id_video IS NOT NULL AND id_category != 0
      ${dateCondition ? 'AND ' + dateCondition.replace('WHERE', '') : ''}
      GROUP BY id_video
      ORDER BY play_count DESC
      LIMIT 3
    `);

    const videos = await Video.findAll({
      attributes: ['id', 'title', 'img'],
      limit: 100000
    });
    for (const video of topVideosResult) {
      const foundVideo = videos.find(v => v.id === video.id_video);
      if (foundVideo) {
        video.title = foundVideo.title;
        video.img = foundVideo.img;
      } else {
        video.title = 'Unknown Video';
        video.img = null;
      }
      video.play_count = parseInt(video.play_count, 10);
    }

    // 4. Nombre de lectures par catégorie
    const [playsPerCategoryResult] = await global.sequelize.query(`
      SELECT id_category, COUNT(*) as play_count
      FROM device_uses
      WHERE id_category IS NOT NULL
      ${dateCondition ? 'AND ' + dateCondition.replace('WHERE', '') : ''}
      GROUP BY id_category
      ORDER BY play_count DESC
    `);

    const categories = await Category.findAll({
      attributes: ['id', 'title', 'icon'],
      limit: 100000
    });

    for (const ppc of playsPerCategoryResult) {
      if( ppc.id_category !== null) {
        const category = categories.find(c => c.id === ppc.id_category);
        if (category) {
          ppc.title = category.title;
          ppc.icon = category.icon;
        } else if (ppc.id_category === 0) {
          ppc.title = 'From device files';
          ppc.icon = 'phone_iphone';
        } else {
          ppc.title = 'Unknown';
          ppc.icon = 'question-circle';
        }
      }
    }

    res.json({
      total_used_time_seconds: totalUsedTime,
      average_using_time_per_day_minutes: avgPerDay,
      top_videos: topVideosResult,
      plays_per_category: playsPerCategoryResult
    });
  } catch (error) {
    console.error('Error generating global KPIs:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getAllDevicesKpis = async (req, res) => {
  const { days } = req.query;
  let dateFilter = '';
  if (days && !isNaN(days)) {
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - parseInt(days));
    dateFilter = `WHERE \`from\` >= '${fromDate.toISOString().slice(0, 19).replace('T', ' ')}'`;
  }

  try {
    // 1. Base stats per device
    const [deviceStats] = await global.sequelize.query(`
      SELECT 
        d.id AS id_device,
        d.name AS device_name,
        SUM(du.duration) AS total_used_time,
        COUNT(DISTINCT DATE(du.\`from\`)) AS days_used,
        ROUND(SUM(du.duration) / 60 / NULLIF(COUNT(DISTINCT DATE(du.\`from\`)), 0), 2) AS avg_per_day_minutes
      FROM device_uses du
      JOIN devices d ON du.id_device = d.id
      ${dateFilter}
      GROUP BY du.id_device
    `);

    // 2. Top 3 videos per device
    const [topVideosRaw] = await global.sequelize.query(`
      SELECT * FROM (
        SELECT 
          du.id_device,
          du.id_video,
          COUNT(*) as play_count,
          ROW_NUMBER() OVER (PARTITION BY du.id_device ORDER BY COUNT(*) DESC) AS rn
        FROM device_uses du
        WHERE du.id_video IS NOT NULL AND du.id_category != 0
        ${dateFilter ? 'AND ' + dateFilter.replace('WHERE', '') : ''}
        GROUP BY du.id_device, du.id_video
      ) AS ranked
      WHERE rn <= 3
    `);

    const allVideos = await Video.findAll({ attributes: ['id', 'title', 'img'] });

    // Enrichir vidéos
    const topVideosByDevice = {};
    for (const row of topVideosRaw) {
      const found = allVideos.find(v => v.id === row.id_video);
      if (!topVideosByDevice[row.id_device]) topVideosByDevice[row.id_device] = [];
      topVideosByDevice[row.id_device].push({
        id_video: row.id_video,
        play_count: parseInt(row.play_count, 10),
        title: found?.title || 'Unknown',
        img: found?.img || null
      });
    }

    // 3. Plays per category per device
    const [categoriesRaw] = await global.sequelize.query(`
      SELECT du.id_device, du.id_category, COUNT(*) AS play_count
      FROM device_uses du
      WHERE du.id_category IS NOT NULL
      ${dateFilter ? 'AND ' + dateFilter.replace('WHERE', '') : ''}
      GROUP BY du.id_device, du.id_category
    `);

    const allCategories = await Category.findAll({ attributes: ['id', 'title', 'icon'] });
    const playsPerCategoryByDevice = {};
    for (const row of categoriesRaw) {
      if (!playsPerCategoryByDevice[row.id_device]) playsPerCategoryByDevice[row.id_device] = [];
      const found = allCategories.find(c => c.id === row.id_category);
      let title = 'Unknown', icon = 'question-circle';
      if (row.id_category === 0) {
        title = 'From device files';
        icon = 'phone_iphone';
      } else if (found) {
        title = found.title;
        icon = found.icon;
      }

      playsPerCategoryByDevice[row.id_device].push({
        id_category: row.id_category,
        play_count: parseInt(row.play_count, 10),
        title,
        icon
      });
    }

    // 🔁 Regroupement final
    const final = deviceStats.map(device => ({
      id_device: device.id_device,
      device_name: device.device_name,
      total_used_time_seconds: device.total_used_time || 0,
      average_using_time_per_day_minutes: device.avg_per_day_minutes || 0,
      top_videos: topVideosByDevice[device.id_device] || [],
      plays_per_category: playsPerCategoryByDevice[device.id_device]?.sort((a,b) => b.play_count - a.play_count) || []
    }));

    res.json(final);
  } catch (err) {
    console.error('Error generating device-level KPIs:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const uploadDeviceLogs = async (req, res) => {
  const { device, file } = req;

  if (!device || !device.name) {
    logger.error('uploadDeviceLogs : Device not found in request headers.');
    return res.status(401).json({ error: 'Missing device name' });
  }

  if (!file) {
    logger.error('uploadDeviceLogs : No file uploaded');
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const logDir = path.join(global.sharedConfig.devicesLogsPath, device.name);
  fs.mkdirSync(logDir, { recursive: true });

  const today = new Date().toISOString().slice(0, 10);

  try {
    // Créer un stream à partir du buffer mémoire
    const bufferStream = require('stream').Readable.from(file.buffer);

    bufferStream
      .pipe(unzipper.Parse())
      .on('entry', async (entry) => {
        const fileName = entry.path;
        const logFile = path.join(logDir, `${fileName}.${today}`);

        const writeStream = fs.createWriteStream(logFile, { flags: 'a' });
        entry.pipe(writeStream);
      })
      .on('close', () => {
        res.json({ status: 'ok' });
        logger.info(`[uploadDeviceLogs] Logs uploaded successfully for device ${device.name}`);
      })
      .on('error', (err) => {
        logger.error(`[uploadDeviceLogs] unzip error: ${err.message}`);
        res.status(500).json({ error: 'Failed to extract logs' });
      });

  } catch (err) {
    logger.error(`[uploadDeviceLogs] unzip error: ${err.message}`);
    res.status(500).json({ error: 'Failed to process logs' });
  }
};

const getDeviceLogs = async (req, res) => {
  const { deviceName } = req.params;
  const logDir = path.join(global.sharedConfig.devicesLogsPath, deviceName);
  if (!fs.existsSync(logDir)) {
    logger.error(`Device logs directory not found: ${logDir}`);
    return res.status(404).json({ error: 'Device logs not found' });
  }
  try {
    // We will zip the logs directory and send it as a response
    const zip = archiver('zip', {
      zlib: { level: 9 } // Compression level
    });
    res.attachment(`${deviceName}-logs.zip`);
    const archiveStream = zip.pipe(res);
    zip.directory(logDir, false);
    zip.finalize();
    archiveStream.on('close', () => {
      logger.info(`Device logs for ${deviceName} sent successfully.`);
    });
    
  } catch (error) {
    logger.error(`Error fetching device logs for ${deviceName}:`, error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};


// async function that checks if device has last connection within 2 last minutes and update is_connected_to_internet status
const updateDeviceInternetStatus = async () => {
  try {
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
    await Device.update({
      is_connected_to_internet: true
    }, {
      where: {
        last_connection: {
          [Op.gte]: twoMinutesAgo
        }
      }
    })
    await Device.update({
      is_connected_to_internet: false
    }, {
      where: {
        last_connection: {
          [Op.lt]: twoMinutesAgo
        }
      }
    })

    logger.info(`Device internet status updated at ${twoMinutesAgo.toISOString()}`);
  } catch (error) {
    logger.error('Error updating device internet status:', error);
  }
};


setInterval(updateDeviceInternetStatus, 2 * 60 * 1000); // every 2 minutes
updateDeviceInternetStatus(); // initial call to set the status immediately

const router = express.Router();

// Version management routes
router.post('/version/create', isValidToken, createNewVersion);
router.get('/all/versions', isValidToken, getAllVersions);
router.get('/last/version', getLastVersion);
router.post('/version/delete', isValidToken, deleteVersion)

// Device management routes
router.post('/create', isValidToken, createNewDevice);
router.post('/edit', isValidToken, updateDevice);
router.post('/delete', isValidToken, deleteDevice);
router.get('/all', isValidToken, getAllDevices);


router.post('/from-device/logs-upload', isValidDeviceHash, uploader.uploadFile, uploadDeviceLogs);
router.post('/from-device/played-video', isValidDeviceHash, setPlayedVideoFromDevice);
router.post('/from-device/stopped-video', isValidDeviceHash, setStoppedVideoFromDevice);
router.post('/from-device/update-metas', isValidDeviceHash, updateMetasFromDevice);

router.get('/logs/:deviceName', isValidToken, getDeviceLogs);

router.get('/kpis/global', isValidToken, getGlobalKpis);
router.get('/kpis/all-devices', isValidToken, getAllDevicesKpis)


module.exports = router;