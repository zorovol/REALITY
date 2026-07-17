/** Robinhood Chain — EVM L2 (Arbitrum Orbit), ETH gas, stock tokens + Uniswap. */

export const robinhoodMainnet = {
  chainId: 4663,
  name: 'Robinhood Chain',
  nativeSymbol: 'ETH',
  rpcUrl: 'https://rpc.mainnet.chain.robinhood.com',
  explorerUrl: 'https://robinhoodchain.blockscout.com',
  weth: '0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73',
  uniswapV2Router: '0x89e5DB8B5aA49aA85AC63f691524311AEB649eba',
  /** Uniswap V3 — kept for legacy tooling; stock bots trade on V4. */
  uniswapV3Router: '0xCaf681a66D020601342297493863E78C959E5cb2',
  uniswapV3Quoter: '0x33e885eD0Ec9bF04EcfB19341582aADCb4c8A9E7',
  uniswapV3Factory: '0x1f7d7550B1b028f7571E69A784071F0205FD2EfA',
  uniswapV3DefaultFee: 10000,
  /** Uniswap V4 — Robinhood tokenized stocks (RWAs) trade in native-ETH V4 pools. */
  uniswapV4: {
    poolManager: '0x8366a39CC670B4001A1121B8F6A443A643e40951',
    universalRouter: '0x53BF6B0684Ec7eF91e1387Da3D1a1769bC5A6F77',
    quoter: '0x8Dc178eFB8111BB0973Dd9d722ebeFF267c98F94',
    stateView: '0xF3334192D15450CdD385c8B70e03f9A6bD9E673b',
    permit2: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
  },
  /** USDG — Robinhood's Global Dollar stable, quote asset for many stock pools. */
  usdg: '0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168',
  /** Seed stock tokens (fallback / reference prices). */
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
