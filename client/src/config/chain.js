/** Robinhood Chain — client-side network info + MetaMask helpers */
export const CHAIN = {
  chainId: 4663,
  name: 'Robinhood Chain',
  nativeSymbol: 'ETH',
  rpcUrl: 'https://rpc.mainnet.chain.robinhood.com',
  explorerUrl: 'https://robinhoodchain.blockscout.com',
};

export const MEMECOIN_EXAMPLES = ['GORO', 'PEPE', 'DOGE', 'WIF'];

/** Add Robinhood Chain to MetaMask (for imported bot wallet viewing). */
export async function addRobinhoodChainToWallet() {
  if (!window.ethereum?.request) {
    throw new Error('MetaMask not detected');
  }
  await window.ethereum.request({
    method: 'wallet_addEthereumChain',
    params: [{
      chainId: '0x1237', // 4663
      chainName: CHAIN.name,
      nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
      rpcUrls: [CHAIN.rpcUrl],
      blockExplorerUrls: [CHAIN.explorerUrl],
    }],
  });
}

export async function switchToRobinhoodChain() {
  if (!window.ethereum?.request) throw new Error('MetaMask not detected');
  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: '0x1237' }],
    });
  } catch (err) {
    if (err?.code === 4902) {
      await addRobinhoodChainToWallet();
      return;
    }
    throw err;
  }
}
