// uploaders.js
const multer = require('multer');


const memory = multer({ storage: multer.memoryStorage() });

module.exports = {
  uploadFile: memory.single('file'),
};
