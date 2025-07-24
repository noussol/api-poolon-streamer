var http = require('http');
const fs = require('fs');
const yaml = require('js-yaml');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const cron = require('node-cron');


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
if(process.env.PORT){
  config.port = process.env.PORT;
}
global.sharedConfig = config;

const logger = require('./services/logger.js');

const { initDataBase } = require('./services/serverDatabaser.js');
const { runLogsRetention } = require('./services/tools.js');

logger.debug('Will start poolon streamer REST API server');

cron.schedule('0 2 * * *', () => {
  console.log('[LogsRetention] ⏰ Starting daily retention...');
  runLogsRetention();
});


initDataBase(global.sharedConfig.database).then(async ()=> {

  const app = express();
  const server = http.createServer(app)

  app.use(cors({
    origin: '*',
    allowedHeaders: '*',
  }))
  app.use(bodyParser.json({ limit: '50mb' }));
  app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));



  app.get('/ping', (req, res) => {
    res.send('Pong!');
  });

  app.get('/.well-known/acme-challenge/:content', (req, res) => {
      const challengePath = path.join(__dirname, '.well-known', 'acme-challenge', req.params.content);
      if (fs.existsSync(challengePath)) {
          return res.sendFile(challengePath);
      } else {
          return res.status(404).send('Challenge file not found.');
      }
  });

  app.get('/file/POOLONKEYJERUOOOOIRHF89744415APAKDHFGG/:filename', (req, res) => {
      const filePath = path.join(path.join(__dirname, 'public'), req.params.filename);
  
      // Check if the file exists
      if (!fs.existsSync(filePath)) {
          return res.status(404).send('File not found.');
      }
  
      // Send the file
      res.sendFile(filePath);
  });


  const userRoutes = require('./routes/userRoutes.js');
  const catalogueRoutes = require('./routes/catalogueRoutes.js');
  const deviceRoutes = require('./routes/deviceRoutes.js');
  

  app.use('/users', userRoutes)
  app.use('/catalogue', catalogueRoutes.router)
  app.use('/device', deviceRoutes)

  await catalogueRoutes.fetchVideosAndCategoriesFs()

  server.listen(config.port, config.hostname, () => {
    logger.log(`Server running at http://${config.hostname}:${config.port}/`);
  });

}).catch((err)=> logger.error(err))