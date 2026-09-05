const catchAsync = require('../../utils/catchAsync');
const AppError = require('../../utils/AppError');
const storageService = require('../../storage/storage.service');
const { sendResponse } = require('../../utils/response');

const path = require('path');
const fs = require('fs');

const uploadImage = catchAsync(async (req, res) => {
  if (!req.file) throw new AppError('No image file provided', 400);

  const url = await storageService.uploadFile(req.file.buffer, req.file.originalname, 'images', req.file.mimetype);
  sendResponse(res, 200, { url }, 'Image uploaded successfully');
});

const uploadDocument = catchAsync(async (req, res) => {
  if (!req.file) throw new AppError('No document file provided', 400);

  const url = await storageService.uploadFile(req.file.buffer, req.file.originalname, 'documents', req.file.mimetype);
  sendResponse(res, 200, { url }, 'Document uploaded successfully');
});

const uploadPublicDocument = catchAsync(async (req, res) => {
  if (!req.file) throw new AppError('No document file provided', 400);

  const url = await storageService.uploadFile(req.file.buffer, req.file.originalname, 'public-documents', req.file.mimetype);
  sendResponse(res, 200, { url }, 'Public document uploaded successfully');
});

const uploadVideo = catchAsync(async (req, res) => {
  if (!req.file) throw new AppError('No video file provided', 400);

  const url = await storageService.uploadFile(
    req.file.buffer,
    req.file.originalname,
    'community-videos',
    req.file.mimetype,
  );
  sendResponse(res, 200, { url }, 'Video uploaded successfully');
});

const uploadVideoChunk = catchAsync(async (req, res) => {
  if (!req.file) throw new AppError('No chunk file provided', 400);

  const { uploadId, chunkIndex, totalChunks, fileName, mimetype } = req.body;
  const index = parseInt(chunkIndex, 10);
  const total = parseInt(totalChunks, 10);

  if (!uploadId || isNaN(index) || isNaN(total) || total <= 0) {
    throw new AppError('Invalid chunk upload metadata', 400);
  }

  const chunkDir = path.join(__dirname, '../../../public/uploads/temp_chunks', uploadId.replace(/[^a-zA-Z0-9_-]/g, ''));
  if (!fs.existsSync(chunkDir)) {
    fs.mkdirSync(chunkDir, { recursive: true });
  }

  const chunkPath = path.join(chunkDir, `part_${String(index).padStart(6, '0')}`);
  fs.writeFileSync(chunkPath, req.file.buffer);

  const parts = fs.readdirSync(chunkDir).filter(f => f.startsWith('part_'));
  if (parts.length === total) {
    parts.sort();
    const buffers = parts.map(file => fs.readFileSync(path.join(chunkDir, file)));
    const mergedBuffer = Buffer.concat(buffers);

    const safeName = (fileName || 'video.mp4').replace(/[^a-zA-Z0-9._-]/g, '_');
    const url = await storageService.uploadFile(
      mergedBuffer,
      safeName,
      'community-videos',
      mimetype || 'video/mp4'
    );

    try {
      fs.rmSync(chunkDir, { recursive: true, force: true });
    } catch {}

    return sendResponse(res, 200, { url, completed: true }, 'Video upload complete');
  }

  return sendResponse(res, 200, { completed: false, receivedChunk: index, totalChunks: total }, 'Chunk received');
});

module.exports = {
  uploadImage,
  uploadDocument,
  uploadPublicDocument,
  uploadVideo,
  uploadVideoChunk,
};
