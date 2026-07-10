/** Robinhood Chain — EVM L2 (Arbitrum Orbit), ETH gas, stock tokens + Uniswap. */

export const robinhoodMainnet = {
  chainId: 4663,
  name: 'Robinhood Chain',
  nativeSymbol: 'ETH',
  rpcUrl: 'https://rpc.mainnet.chain.robinhood.com',
  explorerUrl: 'https://robinhoodchain.blockscout.com',
  weth: '0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73',
  uniswapV2Router: '0x89e5DB8B5aA49aA85AC63f691524311AEB649eba',
  /** Default stock tokens on Robinhood Chain mainnet (July 2026). */
  stockTokens: [
    { symbol: 'AAPL', address: '0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9', priceUsd: 220 },
    { symbol: 'NVDA', address: '0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC', priceUsd: 140 },
    { symbol: 'TSLA', address: '0x322F0929c4625eD5bAd873c95208D54E1c003b2d', priceUsd: 280 },
    { symbol: 'QQQ', address: '0xD5f3879160bc7c32ebb4dC785F8a4F505888de68', priceUsd: 520 },
  ],
};

export const robinhoodTestnet = {
  chainId: 46630,
  name: 'Robinhood Chain Testnet',
  nativeSymbol: 'ETH',
  rpcUrl: 'https://rpc.testnet.chain.robinhood.com',
  explorerUrl: 'https://explorer.testnet.chain.robinhood.com',
  weth: '0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73',
  uniswapV2Router: '0x89e5DB8B5aA49aA85AC63f691524311AEB649eba',
  stockTokens: [],
};

export function txExplorerUrl(explorerBase, txHash) {
  const base = String(explorerBase || robinhoodMainnet.explorerUrl).replace(/\/$/, '');
  return `${base}/tx/${txHash}`;
}

export function addressExplorerUrl(explorerBase, address) {
  const base = String(explorerBase || robinhoodMainnet.explorerUrl).replace(/\/$/, '');
  return `${base}/address/${address}`;
}
