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

    console.log('Initializing socket with URL:', socketUrl);

    // Socket.IO will connect to `${socketUrl}${path}`.
    // When API_BASE_URL contains a path (e.g. /arcade), this will resolve to
    // `${API_BASE_URL}/socket.io/`.
    const socketPath = '/socket.io/';
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
