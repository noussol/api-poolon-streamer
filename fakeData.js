const { faker } = require('@faker-js/faker');
const fs = require('fs');
const { hideBin } = require('yargs/helpers');
const yaml = require('js-yaml');
const yargs = require('yargs/yargs');

const argv = yargs(hideBin(process.argv)).option('config', {
  alias: 'c',
  describe: 'Path to YAML configuration file',
  type: 'string',
  default: 'config.yaml',
  demandOption: true, // Makes sure the config path is provided
}).argv;

// Load configuration from YAML
const loadConfig = (path) => {
  try {
    const fileContents = fs.readFileSync(path, 'utf8');
    return yaml.load(fileContents);
  } catch (e) {
    console.error(`Failed to read or parse the YAML config file: ${e.message}`);
    process.exit(1);
  }
};

const config = loadConfig(argv.config);
global.sharedConfig = config;

const logger = require('./services/logger.js');


(async () => {
  const databaseInfos = {
    host: 'localhost',
    port: 3306,
    user: 'your_user',
    password: 'your_password',
    database: 'your_database',
    // Optional: socketPath: '/var/run/mysqld/mysqld.sock'
  };
const { initDataBase } = require('./services/serverDatabaser');

  await initDataBase(global.sharedConfig.database);
const { DeviceUse } = require('./models/deviceUseModel');
const { Device } = require('./models/deviceModel');
const { Video } = require('./models/videosModel');
const { Category } = require('./models/categoryModel');

  const devices = await Device.findAll();
  const videos = await Video.findAll({ include: [{ model: Category, as: 'category' }] });

  if (!devices.length || !videos.length) {
    console.error('You must have at least one device and one video to generate data.');
    return;
  }

  const fakeUses = [];

  for (let i = 0; i < 50; i++) {
    const randomDevice = faker.helpers.arrayElement(devices);
    const randomVideo = faker.helpers.arrayElement(videos);

    const from = faker.date.recent({ days: 30 });
    const to = faker.datatype.boolean() ? faker.date.between({ from, to: new Date() }) : null;

    fakeUses.push({
      id_device: randomDevice.id,
      from,
      to,
      connected_to_internet: faker.datatype.boolean(),
      city: faker.location.city(),
      country: faker.location.country(),
      ip: faker.internet.ip(),
      id_category: randomVideo.category.id,
      id_video: randomVideo.id
    });
  }

  try {
    await DeviceUse.bulkCreate(fakeUses);
    console.log(`✅ Successfully inserted ${fakeUses.length} fake device uses.`);
  } catch (err) {
    console.error('❌ Failed to insert fake device uses:', err);
  }

  process.exit();
})();
