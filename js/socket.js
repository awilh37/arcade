import { API_BASE_URL, TOKEN_KEY } from './config.js';

let socket = null;

export function initSocket() {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return null;

    // Determine the socket server URL
    // Use same protocol and host as the page
    const protocol = window.location.protocol === 'https:' ? 'https' : 'http';
    const socketUrl = window.location.hostname === 'localhost' 
        ? `${protocol}://localhost:5000`
        : `${protocol}://${window.location.host}`;
    
    console.log('Initializing socket with URL:', socketUrl);

    // Assuming socket.io client script is loaded in index.html
    // When served from /arcade/, need to tell socket.io to use /arcade/socket.io/ path
    // so Caddy's reverse proxy rule can match and route it correctly
    const socketPath = window.location.pathname.startsWith('/arcade') ? '/arcade/socket.io/' : '/socket.io/';
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
