import { io } from 'socket.io-client';
const socket = io('/', { autoConnect: true, reconnection: true, reconnectionAttempts: 10, transports: ['websocket','polling'] });
socket.on('connect', () => console.log('🔌 Socket connected:', socket.id));
socket.on('disconnect', r => console.log('🔌 Disconnected:', r));
export default socket;