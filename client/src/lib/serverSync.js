import { api } from './api.js';
import { getWalletSecretKey } from './walletAuth.js';

export async function syncWalletToServer({ walletAddress, password, secretKey }) {
  return api.registerWallet({ walletAddress, password, secretKey });
}

/** Ensure Render session exists so bots can execute on-chain. */
export async function ensureServerSession(walletAddress, password) {
  try {
    await api.login(walletAddress, password);
    return true;
  } catch (loginErr) {
    const secretKey = await getWalletSecretKey(walletAddress, password);
    if (!secretKey) throw loginErr;
    await syncWalletToServer({ walletAddress, password, secretKey });
    return true;
  }
}

export async function syncBotToFloor(bot, walletAddress) {
  const { syncFloorBot } = await import('./floorApi.js');
  return syncFloorBot(bot, walletAddress);
}
