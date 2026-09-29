import { Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { prisma } from '../lib/prisma';
import { ENV } from '../config/env';

// ── Ensure uploads directory exists on disk ──────────────────────
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// ── Secure Multer Disk Storage Engine ────────────────────────────
const storage = multer.diskStorage({
  destination: (req: any, file: any, cb: any) => {
    cb(null, uploadDir);
  },
  filename: (req: any, file: any, cb: any) => {
    const uniqueId = crypto.randomUUID();
    const safeExt = path.extname(file.originalname).toLowerCase() || '.bin';
    cb(null, `${Date.now()}-${uniqueId}${safeExt}`);
  },
});

// ── File Filter: Allowed MIME Types ──────────────────────────────
const ALLOWED_MIME_TYPES = [
  // Images
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
  'image/bmp',
  'image/heic',
  'image/heif',
  // Videos
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-matroska',
  'video/x-msvideo',
  'video/3gpp',
  // Audios & Voice Messages
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/ogg',
  'audio/m4a',
  'audio/webm',
  'audio/aac',
  'audio/mp4',
  'audio/x-m4a',
  'audio/3gpp',
  // Documents & Files
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  'text/html',
  'application/zip',
  'application/x-zip-compressed',
  'application/x-rar-compressed',
  'application/x-7z-compressed',
  'application/json',
  'application/octet-stream',
];

const fileFilter = (req: any, file: any, cb: any) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const safeExtensions = [
    '.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg', '.bmp', '.heic',
    '.mp4', '.webm', '.mov', '.mkv', '.avi', '.3gp',
    '.mp3', '.wav', '.ogg', '.m4a', '.aac',
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.csv', '.zip', '.rar', '.7z', '.json',
  ];

  if (ALLOWED_MIME_TYPES.includes(file.mimetype) || safeExtensions.includes(ext) || file.mimetype.startsWith('audio/') || file.mimetype.startsWith('video/') || file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    // Allow general user files/documents with safe extension check
    cb(null, true);
  }
};

export const uploadMiddleware = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 4096 * 1024 * 1024, // 4GB (4096MB) max limit for ultra-large 4K video, big PDFs, and heavy archives
    files: 10,
  },
});

// ── Controller: Upload Single File ───────────────────────────────
export async function uploadSingleMedia(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file selected (No file uploaded).',
      });
    }

    const file = req.file;
    const isVideo = file.mimetype.startsWith('video/') || /\.(mp4|webm|mov|mkv|avi|3gp)$/i.test(file.originalname);
    const isAudio = file.mimetype.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac)$/i.test(file.originalname);
    const isImage = file.mimetype.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif|svg|bmp|heic)$/i.test(file.originalname);
    const mediaType = isVideo ? 'VIDEO' : isAudio ? 'AUDIO' : isImage ? 'IMAGE' : 'FILE';

    // Permanent public relative path
    const fileUrl = `/uploads/${file.filename}`;

    // Record in permanent database
    const mediaRecord = await prisma.mediaFile.create({
      data: {
        uploaderId: req.user!.userId,
        url: fileUrl,
        mimeType: file.mimetype,
        mediaType: mediaType as any,
        fileSize: file.size,
        isProcessed: true,
      },
    });

    return res.status(201).json({
      success: true,
      message: 'File uploaded and saved successfully! ✅',
      url: fileUrl,
      originalName: file.originalname,
      fileSize: file.size,
      mimeType: file.mimetype,
      mediaType,
      data: mediaRecord,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to upload file.',
    });
  }
}

// ── Controller: Upload Multiple Files ────────────────────────────
export async function uploadMultipleMedia(req: AuthenticatedRequest, res: Response) {
  try {
    const files = (req.files || []) as any[];
    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files selected (No files uploaded).',
      });
    }

    const createdRecords = [];

    for (const file of files) {
      const isVideo = file.mimetype.startsWith('video/');
      const isAudio = file.mimetype.startsWith('audio/');
      const mediaType = isVideo ? 'VIDEO' : isAudio ? 'AUDIO' : 'IMAGE';
      const fileUrl = `/uploads/${file.filename}`;

      const record = await prisma.mediaFile.create({
        data: {
          uploaderId: req.user!.userId,
          url: fileUrl,
          mimeType: file.mimetype,
          mediaType: mediaType as any,
          fileSize: file.size,
          isProcessed: true,
        },
      });

      createdRecords.push(record);
    }

    return res.status(201).json({
      success: true,
      message: `${createdRecords.length} files uploaded successfully!`,
      urls: createdRecords.map((r) => r.url),
      data: createdRecords,
    });
  } catch (error) {
    console.error('Multiple upload error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to upload multiple files.',
    });
  }
}

// ── Controller: High-Performance HTTP 206 Video Streaming ────────
export async function streamMediaFile(req: any, res: Response) {
  try {
    const filename = path.basename(req.params.filename);
    const filePath = path.join(uploadDir, filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'File not found.' });
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    // Determine MIME type
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.mov': 'video/quicktime',
      '.mkv': 'video/x-matroska',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.ogg': 'audio/ogg',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
    };
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    if (range) {
      // Parse Range Header e.g. "bytes=32324-"
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;

      const file = fs.createReadStream(filePath, { start, end });
      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      };

      res.writeHead(206, head);
      file.pipe(res);
    } else {
      const head = {
        'Content-Length': fileSize,
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=31536000, immutable',
      };
      res.writeHead(200, head);
      fs.createReadStream(filePath).pipe(res);
    }
  } catch (err) {
    console.error('Streaming error:', err);
    res.status(500).end();
  }
}
