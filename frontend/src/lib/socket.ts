import { io, Socket } from 'socket.io-client';

const getSocketUrl = (): string => {
  const envSocket = process.env.NEXT_PUBLIC_SOCKET_URL;
  if (envSocket && envSocket !== 'http://127.0.0.1:5001' && envSocket !== 'http://localhost:5001') {
    return envSocket.replace(/\/$/, '');
  }

  const envApi = process.env.NEXT_PUBLIC_API_URL;
  if (envApi && envApi !== 'http://127.0.0.1:5001' && envApi !== 'http://localhost:5001') {
    return envApi.replace(/\/api$/, '').replace(/\/$/, '');
  }

  if (typeof window !== 'undefined') {
    const isLocal =
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname.startsWith('192.168.') ||
      window.location.hostname.startsWith('10.');

    if (isLocal) {
      const port = '5001';
      const hostname = window.location.hostname || 'localhost';
      return `${window.location.protocol}//${hostname}:${port}`;
    }

    return 'https://nuraiyan-backend.onrender.com';
  }

  return 'https://nuraiyan-backend.onrender.com';
};

const BACKEND_URL = getSocketUrl();

let socket: Socket | null = null;

export function getSocket(token?: string): Socket {
  const currentToken =
    token || (typeof window !== 'undefined' ? localStorage.getItem('nuraiyan_token') : null);

  if (!socket) {
    socket = io(BACKEND_URL, {
      auth: (cb) => {
        const t =
          typeof window !== 'undefined' ? localStorage.getItem('nuraiyan_token') : null;
        cb({ token: t });
      },
      withCredentials: true,
      autoConnect: true,
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 50,
      reconnectionDelay: 1000,
      timeout: 10000,
    });

    socket.on('connect', () => {
      console.log('✅ Real-time Socket connected:', socket?.id);
    });

    socket.on('connect_error', (err) => {
      console.warn('⚠️ Real-time Socket connect error:', err.message);
    });

    socket.on('disconnect', (reason) => {
      console.log('❌ Real-time Socket disconnected:', reason);
    });
  } else if (currentToken && !socket.connected) {
    socket.auth = { token: currentToken };
    socket.connect();
  }

  return socket;
}

