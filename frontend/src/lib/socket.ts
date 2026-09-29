import { io, Socket } from 'socket.io-client';

const BACKEND_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://127.0.0.1:5001';

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

