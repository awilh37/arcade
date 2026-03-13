import { API_BASE_URL, TOKEN_KEY } from './config.js';

let socket = null;

export function initSocket() {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return null;

    // Determine the socket server URL.
    // For local dev, connect to the local backend. For deployed builds, use the configured API base URL.
    const socketUrl = window.location.hostname === 'localhost'
        ? 'http://localhost:5000'
        : API_BASE_URL.replace(/\/$/, '');

    // If API_BASE_URL includes a path (e.g. /arcade), we must ensure Socket.IO uses the same path.
    // Socket.IO treats `path` as absolute from the origin, so `/socket.io/` would bypass any base path.
    const apiUrl = new URL(socketUrl);
    const basePath = apiUrl.pathname.replace(/\/$/, '');
    const socketPath = basePath ? `${basePath}/socket.io/` : '/socket.io/';

    console.log('Initializing socket with URL:', socketUrl);
    console.log('Using socket path:', socketPath);

    socket = io(socketUrl, {
        auth: { token },
        path: socketPath
    });

    socket.on('connect', () => {
        console.log('Socket connected:', socket.id);
    });

    socket.on('connect_error', (err) => {
        console.error('Socket connection error:', err.message);
    });

    return socket;
}

export function getSocket() {
    return socket;
}
