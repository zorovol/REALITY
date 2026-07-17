/** Ethereum mainnet — Uniswap V3 stock-token trading. */

export const ethereumMainnet = {
  chainId: 1,
  name: 'Ethereum',
  nativeSymbol: 'ETH',
  rpcUrl: 'https://ethereum.publicnode.com',
  explorerUrl: 'https://etherscan.io',
  weth: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  usdc: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  /** Uniswap V3 periphery (canonical mainnet). */
  uniswapV3Router: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45', // SwapRouter02
  uniswapV3Quoter: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e', // QuoterV2
  uniswapV3Factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
  uniswapV3DefaultFee: 3000,
  /** Seed Ondo / xStock trackers — discovery expands via DexScreener. */
  stockTokens: [
    { symbol: 'NVDAon', address: '0x2D1F7226Bd1F780AF6B9A49DCC0aE00E8Df4bDEE', priceUsd: 130 },
    { symbol: 'NVDAonW', address: '0xC763873bb5509b6Bfe0a76A902207E41f2AaF340', priceUsd: 130 },
    { symbol: 'TSLAon', address: '0xf6b1117ec07684D3958caD8BEb1b302bfD21103f', priceUsd: 380 },
    { symbol: 'AAPLon', address: '0x14c3abF95Cb9C93a8b82C1CdCB76D72Cb87b2d4c', priceUsd: 220 },
    { symbol: 'GOOGLon', address: '0xbA47214eDd2bb43099611b208f75E4b42FDcfEDc', priceUsd: 180 },
    { symbol: 'SPYon', address: '0xFeDC5f4a6c38211c1338aa411018DFAf26612c08', priceUsd: 580 },
    { symbol: 'QQQon', address: '0x0e397938C1Aa0680954093495B70A9F5e2249aBa', priceUsd: 520 },
    { symbol: 'SPCXon', address: '0xc9eef266834730340A55B6CC24621B31BAF55581', priceUsd: 120 },
  ],
};

export function txExplorerUrl(explorerBase, txHash) {
  const base = String(explorerBase || ethereumMainnet.explorerUrl).replace(/\/$/, '');
  return `${base}/tx/${txHash}`;
}

export function addressExplorerUrl(explorerBase, address) {
  const base = String(explorerBase || ethereumMainnet.explorerUrl).replace(/\/$/, '');
  return `${base}/address/${address}`;
}
