const multer = require('multer');

// Store file in memory to pass buffer to DigitalOcean Spaces
const storage = multer.memoryStorage();

const upload = multer({ 
  storage,
  limits: { fileSize: 15 * 1024 * 1024 } // 15MB limit
});

module.exports = upload;
