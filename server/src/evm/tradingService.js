import { ethers } from 'ethers';
import { txExplorerUrl } from '../chain/robinhood.js';

/** UniversalRouter command + v4-periphery action bytes. */
const CMD_V4_SWAP = '0x10';
const ACTIONS = '0x060c0f'; // SWAP_EXACT_IN_SINGLE, SETTLE_ALL, TAKE_ALL

const UR_ABI = [
  'function execute(bytes commands, bytes[] inputs, uint256 deadline) payable',
];

const V4_QUOTER_ABI = [
  'function quoteExactInputSingle(((address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks) poolKey,bool zeroForOne,uint128 exactAmount,bytes hookData)) returns (uint256 amountOut,uint256 gasEstimate)',
];

const PERMIT2_ABI = [
  'function approve(address token, address spender, uint160 amount, uint48 expiration)',
  'function allowance(address owner, address token, address spender) view returns (uint160 amount, uint48 expiration, uint48 nonce)',
];

const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
];

const ZERO = '0x0000000000000000000000000000000000000000';
const MAX_UINT160 = (1n << 160n) - 1n;
const MAX_UINT48 = (1n << 48n) - 1n;

/** Fee/tickSpacing combos to try when discovery has no pool info for a token. */
const FALLBACK_POOLS = [
  { fee: 10000, tickSpacing: 200 },
  { fee: 3000, tickSpacing: 60 },
  { fee: 50000, tickSpacing: 1000 },
  { fee: 30000, tickSpacing: 600 },
  { fee: 500, tickSpacing: 10 },
  { fee: 100, tickSpacing: 1 },
];

/**
 * Uniswap V4 swaps on Robinhood Chain — buys/sells Robinhood tokenized
 * stocks (RWAs) against native ETH through the UniversalRouter.
 */
export class TradingService {
  /**
   * @param {{ rpcUrl: string, chainId: number, explorerUrl: string, uniswapV4: object }} chain
   */
  constructor(chain) {
    this.chain = chain;
    this.provider = new ethers.JsonRpcProvider(chain.rpcUrl, {
      chainId: chain.chainId,
      name: chain.name || 'robinhood',
    });
    this.routerAddress = chain.uniswapV4.universalRouter;
    this.permit2Address = chain.uniswapV4.permit2;
    this.router = new ethers.Contract(this.routerAddress, UR_ABI, this.provider);
    this.quoter = new ethers.Contract(chain.uniswapV4.quoter, V4_QUOTER_ABI, this.provider);
    this.coder = ethers.AbiCoder.defaultAbiCoder();
    this.explorerUrl = chain.explorerUrl;
  }

  walletFromPrivateKey(privateKeyHex) {
    const key = String(privateKeyHex).trim();
    const normalized = key.startsWith('0x') ? key : `0x${key}`;
    return new ethers.Wallet(normalized, this.provider);
  }

  async getBalanceEth(address) {
    const bal = await this.provider.getBalance(address);
    return Number(ethers.formatEther(bal));
  }

  async getTokenBalanceRaw(wallet, tokenAddress) {
    const token = new ethers.Contract(tokenAddress, ERC20_ABI, this.provider);
    return token.balanceOf(wallet.address);
  }

  async buildTxOverrides(extra = {}) {
    const fee = await this.provider.getFeeData();
    const gasLimit = 900_000n;
    if (fee.maxFeePerGas && fee.maxFeePerGas > 0n) {
      const priority = fee.maxPriorityFeePerGas && fee.maxPriorityFeePerGas > 0n
        ? fee.maxPriorityFeePerGas
        : fee.maxFeePerGas / 10n;
      return {
        gasLimit,
        type: 2,
        maxFeePerGas: fee.maxFeePerGas,
        maxPriorityFeePerGas: priority,
        ...extra,
      };
    }
    return {
      gasLimit,
      type: 0,
      gasPrice: fee.gasPrice ?? 100_000_000n,
      ...extra,
    };
  }

  formatTxError(err) {
    const msg = err?.shortMessage || err?.reason || err?.message || 'transaction failed';
    if (/insufficient funds/i.test(msg)) {
      return 'need more ETH for gas on Robinhood Chain (chain ID 4663) — not Ethereum L1';
    }
    if (/nonce/i.test(msg)) return `${msg} — retrying next tick`;
    if (/V4TooLittleReceived|slippage|PriceLimit/i.test(msg)) {
      return `${msg} — stock pool moved, will retry`;
    }
    return msg.slice(0, 200);
  }

  /** poolKey for a native-ETH V4 pool (currency0 = native, currency1 = token). */
  poolKey(tokenAddress, { fee, tickSpacing }) {
    return {
      currency0: ZERO,
      currency1: ethers.getAddress(tokenAddress),
      fee,
      tickSpacing,
      hooks: ZERO,
    };
  }

  /**
   * Quote a swap and return the best pool for it.
   * @param {boolean} buying true = ETH -> token, false = token -> ETH
   * @param {bigint} [minOut] reject quotes below this — guards against dead
   *   pools priced far off the stock's real price.
   */
  async quoteBestPool(tokenAddress, amountIn, pools, buying, minOut = 0n) {
    const candidates = pools?.length ? pools : FALLBACK_POOLS;
    let best = null;
    for (const pool of candidates) {
      try {
        const [out] = await this.quoter.quoteExactInputSingle.staticCall({
          poolKey: this.poolKey(tokenAddress, pool),
          zeroForOne: buying,
          exactAmount: amountIn,
          hookData: '0x',
        });
        if (out > 0n && out >= minOut && (!best || out > best.amountOut)) {
          best = { amountOut: out, pool };
        }
      } catch {
        /* pool doesn't exist or no liquidity at this tier */
      }
    }
    return best;
  }

  async quoteEthForToken(tokenAddress, ethAmount, pools, minOut = 0n) {
    const value = ethers.parseEther(String(Math.max(ethAmount, 0.00001)));
    const best = await this.quoteBestPool(tokenAddress, value, pools, true, minOut);
    return best?.amountOut ?? 0n;
  }

  async canSwapEthForToken(tokenAddress, ethAmount, pools, minOut = 0n) {
    try {
      const out = await this.quoteEthForToken(tokenAddress, ethAmount, pools, minOut);
      return out > 0n;
    } catch {
      return false;
    }
  }

  /** Encode the UniversalRouter V4 swap input for an exact-in single swap. */
  encodeV4Swap({ tokenAddress, pool, zeroForOne, amountIn, amountOutMin }) {
    const key = this.poolKey(tokenAddress, pool);
    const swapParams = this.coder.encode(
      ['tuple(tuple(address,address,uint24,int24,address),bool,uint128,uint128,bytes)'],
      [[
        [key.currency0, key.currency1, key.fee, key.tickSpacing, key.hooks],
        zeroForOne,
        amountIn,
        amountOutMin,
        '0x',
      ]],
    );
    const settleCurrency = zeroForOne ? key.currency0 : key.currency1;
    const takeCurrency = zeroForOne ? key.currency1 : key.currency0;
    const settleParams = this.coder.encode(['address', 'uint256'], [settleCurrency, amountIn]);
    const takeParams = this.coder.encode(['address', 'uint256'], [takeCurrency, amountOutMin]);
    return this.coder.encode(['bytes', 'bytes[]'], [ACTIONS, [swapParams, settleParams, takeParams]]);
  }

  async executeSwap(wallet, v4Input, value = 0n) {
    const router = this.router.connect(wallet.connect(this.provider));
    const deadline = Math.floor(Date.now() / 1000) + 300;
    const overrides = await this.buildTxOverrides(value > 0n ? { value } : {});
    const tx = await router.execute(CMD_V4_SWAP, [v4Input], deadline, overrides);
    const receipt = await tx.wait();
    if (!receipt || receipt.status !== 1) {
      throw new Error('swap transaction reverted on-chain');
    }
    return receipt;
  }

  /** Buy a tokenized stock with native ETH. */
  async buyToken({ wallet, mintAddress, ethAmount, pools, minOut = 0n }) {
    const value = ethers.parseEther(String(ethAmount));
    const best = await this.quoteBestPool(mintAddress, value, pools, true, minOut);
    if (!best) throw new Error('no fairly-priced V4 ETH pool for this stock token');
    const amountOutMin = (best.amountOut * 90n) / 100n; // 10% slippage — thin RWA pools

    const v4Input = this.encodeV4Swap({
      tokenAddress: mintAddress,
      pool: best.pool,
      zeroForOne: true,
      amountIn: value,
      amountOutMin,
    });
    const receipt = await this.executeSwap(wallet, v4Input, value);

    return {
      signature: receipt.hash,
      ethAmount: Number(ethAmount),
      solAmount: Number(ethAmount),
      explorerUrl: txExplorerUrl(this.explorerUrl, receipt.hash),
    };
  }

  /** UniversalRouter pulls ERC20s through Permit2 — set both approvals once. */
  async ensurePermit2Approval(wallet, tokenAddress) {
    const signer = wallet.connect(this.provider);
    const token = new ethers.Contract(tokenAddress, ERC20_ABI, signer);

    const erc20Allowance = await token.allowance(wallet.address, this.permit2Address);
    if (erc20Allowance < MAX_UINT160) {
      const tx = await token.approve(this.permit2Address, ethers.MaxUint256, await this.buildTxOverrides());
      const receipt = await tx.wait();
      if (!receipt || receipt.status !== 1) throw new Error('token approve (permit2) reverted');
    }

    const permit2 = new ethers.Contract(this.permit2Address, PERMIT2_ABI, signer);
    const [amount, expiration] = await permit2.allowance(wallet.address, tokenAddress, this.routerAddress);
    const nowSec = BigInt(Math.floor(Date.now() / 1000));
    if (amount < MAX_UINT160 / 2n || (expiration !== 0n && expiration < nowSec + 3600n)) {
      const tx = await permit2.approve(
        tokenAddress,
        this.routerAddress,
        MAX_UINT160,
        MAX_UINT48,
        await this.buildTxOverrides(),
      );
      const receipt = await tx.wait();
      if (!receipt || receipt.status !== 1) throw new Error('permit2 approve reverted');
    }
  }

  /** Sell full stock token balance back to native ETH. */
  async sellToken({ wallet, mintAddress, pools }) {
    const token = new ethers.Contract(mintAddress, ERC20_ABI, this.provider);
    const balance = await token.balanceOf(wallet.address);
    if (balance === 0n) return null;

    const best = await this.quoteBestPool(mintAddress, balance, pools, false);
    if (!best) throw new Error('no V4 ETH pool with liquidity to sell this stock token');
    const amountOutMin = (best.amountOut * 90n) / 100n;

    await this.ensurePermit2Approval(wallet, mintAddress);

    const v4Input = this.encodeV4Swap({
      tokenAddress: mintAddress,
      pool: best.pool,
      zeroForOne: false,
      amountIn: balance,
      amountOutMin,
    });
    const receipt = await this.executeSwap(wallet, v4Input);
    const ethOut = Number(ethers.formatEther(best.amountOut));

    return {
      signature: receipt.hash,
      ethAmount: ethOut,
      solAmount: ethOut,
      explorerUrl: txExplorerUrl(this.explorerUrl, receipt.hash),
    };
  }
}
