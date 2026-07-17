/** Ethereum mainnet — client-side network info + MetaMask helpers */
export const CHAIN = {
  chainId: 1,
  name: 'Ethereum',
  nativeSymbol: 'ETH',
  rpcUrl: 'https://ethereum.publicnode.com',
  explorerUrl: 'https://etherscan.io',
};

export const STOCK_TOKEN_EXAMPLES = ['NVDAon', 'TSLAon', 'AAPLon', 'SPYon'];

/** Switch MetaMask to Ethereum mainnet (for imported bot wallet viewing). */
export async function addEthereumToWallet() {
  if (!window.ethereum?.request) {
    throw new Error('MetaMask not detected');
  }
  await window.ethereum.request({
    method: 'wallet_switchEthereumChain',
    params: [{ chainId: '0x1' }],
  });
}

/** @deprecated use addEthereumToWallet — kept for older call sites */
export async function addRobinhoodChainToWallet() {
  return addEthereumToWallet();
}

export async function switchToEthereum() {
  return addEthereumToWallet();
}

/** @deprecated */
export async function switchToRobinhoodChain() {
  return switchToEthereum();
}
