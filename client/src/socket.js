import { io } from 'socket.io-client';

export const socket = io({ transports: ['websocket', 'polling'] });

const KEY = 'adi-voter-id';
let voterId = localStorage.getItem(KEY);
if (!voterId) {
  voterId = `viewer-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
  localStorage.setItem(KEY, voterId);
}
export const VOTER_ID = voterId;
