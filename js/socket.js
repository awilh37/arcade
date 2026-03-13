import { API_BASE_URL, TOKEN_KEY } from './config.js';

let socket = null;

export function initSocket() {
    // If we already have a socket instance, reuse it. This avoids duplicate connections when
    // initSocket() is called multiple times (e.g., login + initial auth check).
    if (socket) {
        console.log('Reusing existing socket instance:', socket.id);
        return socket;
    }

    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return null;

    // Determine the socket server URL.
    // For local dev, connect to the local backend. For deployed builds, use the configured API base URL.
    // Note: Socket.IO expects the URL to be the origin (no extra path), and the path option controls the socket endpoint.
    const socketUrl = window.location.hostname === 'localhost'
        ? 'http://localhost:5000'
        : new URL(API_BASE_URL).origin;

    const apiPath = window.location.hostname === 'localhost'
        ? ''
        : new URL(API_BASE_URL).pathname.replace(/\/$/, '');

    const socketPath = apiPath ? `${apiPath}/socket.io/` : '/socket.io/';

    console.log('Initializing socket with URL:', socketUrl);
    console.log('Using socket path:', socketPath);

    socket = io(socketUrl, {
        auth: { token },
        path: socketPath,
        reconnection: false
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
