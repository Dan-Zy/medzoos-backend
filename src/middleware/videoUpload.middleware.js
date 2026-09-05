const multer = require('multer');

const storage = multer.memoryStorage();

const videoUpload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
  fileFilter: (_req, file, cb) => {
    // Permissive for mobile uploads (React Native sends application/octet-stream or generic video)
    cb(null, true);
  },
});

module.exports = videoUpload;
