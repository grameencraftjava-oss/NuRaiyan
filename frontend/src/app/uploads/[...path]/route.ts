import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';

const MIME_MAP: Record<string, string> = {
  // Images
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  bmp: 'image/bmp',
  heic: 'image/heic',
  // Videos
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  mkv: 'video/x-matroska',
  avi: 'video/x-msvideo',
  '3gp': 'video/3gpp',
  // Audios
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  // Documents
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  txt: 'text/plain; charset=utf-8',
  json: 'application/json',
  zip: 'application/zip',
  rar: 'application/x-rar-compressed',
  '7z': 'application/x-7z-compressed',
};

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase().replace(/^\./, '');
  return MIME_MAP[ext] || 'application/octet-stream';
}

function findLocalFilePath(relativeName: string): string | null {
  const safeName = path.normalize(relativeName).replace(/^(\.\.[\/\\])+/, '');
  const candidateDirs = [
    path.resolve(process.cwd(), '..', 'backend', 'uploads'),
    path.resolve(process.cwd(), 'backend', 'uploads'),
    path.resolve(process.cwd(), 'uploads'),
  ];

  for (const dir of candidateDirs) {
    const fullPath = path.join(dir, safeName);
    if (fs.existsSync(fullPath)) {
      try {
        const stat = fs.statSync(fullPath);
        if (stat.isFile()) return fullPath;
      } catch {
        // Continue
      }
    }
  }
  return null;
}

function createSafeWebStream(localDiskPath: string, options?: { start?: number; end?: number }) {
  const nodeStream = fs.createReadStream(localDiskPath, options);
  return new ReadableStream({
    start(controller) {
      nodeStream.on('data', (chunk) => {
        try {
          controller.enqueue(chunk);
        } catch {
          nodeStream.destroy();
        }
      });
      nodeStream.on('end', () => {
        try {
          controller.close();
        } catch {}
      });
      nodeStream.on('error', (err) => {
        try {
          controller.error(err);
        } catch {}
      });
    },
    cancel() {
      nodeStream.destroy();
    },
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const filePath = (params.path || []).join('/');
  if (!filePath) {
    return new NextResponse('File not found', { status: 404 });
  }

  // 1. Try direct disk access (Fastest, zero network overhead, avoids loopback connect EPERM)
  const localDiskPath = findLocalFilePath(filePath);
  if (localDiskPath) {
    try {
      const stat = fs.statSync(localDiskPath);
      const mimeType = getMimeType(localDiskPath);
      const range = request.headers.get('range');

      const headers = new Headers();
      headers.set('Content-Type', mimeType);
      headers.set('Accept-Ranges', 'bytes');
      headers.set('Access-Control-Allow-Origin', '*');
      headers.set('Cross-Origin-Resource-Policy', 'cross-origin');
      headers.set('Cache-Control', 'public, max-age=604800, immutable');

      // Support Range Requests (Vital for Video/Audio streaming & seeking)
      if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10) || 0;
        const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;

        if (start >= stat.size || end >= stat.size) {
          headers.set('Content-Range', `bytes */${stat.size}`);
          return new NextResponse(null, { status: 416, headers });
        }

        const chunksize = end - start + 1;
        headers.set('Content-Range', `bytes ${start}-${end}/${stat.size}`);
        headers.set('Content-Length', chunksize.toString());

        const webStream = createSafeWebStream(localDiskPath, { start, end });

        return new NextResponse(webStream, {
          status: 206,
          headers,
        });
      }

      // Full file response
      headers.set('Content-Length', stat.size.toString());
      const webStream = createSafeWebStream(localDiskPath);

      return new NextResponse(webStream, {
        status: 200,
        headers,
      });
    } catch (diskErr) {
      console.error('[Uploads Route Disk Error]', diskErr);
    }
  }

  // 2. Fallback to HTTP Proxy (for remote/containerized environments)
  try {
    const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5001';
    const baseUrl = rawApiUrl.replace(/\/api$/, '').replace(/\/$/, '');
    const backendUrl = `${baseUrl}/uploads/${filePath}`;
    const range = request.headers.get('range');
    const proxyHeaders: Record<string, string> = {};
    if (range) proxyHeaders['range'] = range;

    const backendRes = await fetch(backendUrl, {
      headers: proxyHeaders,
      cache: 'no-store',
    });

    if (!backendRes.ok && backendRes.status !== 206) {
      return new NextResponse('File not found', { status: 404 });
    }

    const resHeaders = new Headers();
    backendRes.headers.forEach((val, key) => {
      resHeaders.set(key, val);
    });
    resHeaders.set('Access-Control-Allow-Origin', '*');
    resHeaders.set('Cross-Origin-Resource-Policy', 'cross-origin');

    return new NextResponse(backendRes.body, {
      status: backendRes.status,
      headers: resHeaders,
    });
  } catch (netErr) {
    return new NextResponse('File not found', { status: 404 });
  }
}
