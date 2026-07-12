/** Robinhood Chain — EVM L2 (Arbitrum Orbit), ETH gas, stock tokens + Uniswap. */

export const robinhoodMainnet = {
  chainId: 4663,
  name: 'Robinhood Chain',
  nativeSymbol: 'ETH',
  rpcUrl: 'https://rpc.mainnet.chain.robinhood.com',
  explorerUrl: 'https://robinhoodchain.blockscout.com',
  weth: '0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73',
  uniswapV2Router: '0x89e5DB8B5aA49aA85AC63f691524311AEB649eba',
  /** Uniswap V3 — launchpad tokens (Ape.Store / graduated NOXA) trade here at 1% fee tier. */
  uniswapV3Router: '0xCaf681a66D020601342297493863E78C959E5cb2',
  uniswapV3Quoter: '0x33e885eD0Ec9bF04EcfB19341582aADCb4c8A9E7',
  uniswapV3Factory: '0x1f7d7550B1b028f7571E69A784071F0205FD2EfA',
  uniswapV3DefaultFee: 10000,
  /** Launchpads — bot only discovers tokens from these sources. */
  launchpads: {
    apeStore: {
      name: 'ape.store',
      apiBase: 'https://ape.store/api/tokens',
      factory: '0x6e4910ea5A04376032F6564da9a9E4E88B7a87C1',
    },
    noxa: {
      name: 'noxa',
      factory: '0xD9eC2db5f3D1b236843925949fe5bd8a3836FCcB',
      launchEventTopic: '0xdb51ea9ad51ab453a65a4cb7e60c3cb378c9501bb002609f8f97778fb6c4235a',
      startBlock: 61688,
    },
  },
  /** Stock tokens — excluded from memecoin bot pool. */
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
