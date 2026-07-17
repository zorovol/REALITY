import { ethers } from 'ethers';
import { txExplorerUrl } from '../chain/ethereum.js';

const ROUTER_ABI = [
  'function exactInputSingle((address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 amountIn,uint256 amountOutMinimum,uint160 sqrtPriceLimitX96)) payable returns (uint256 amountOut)',
  'function exactInput((bytes path,address recipient,uint256 amountIn,uint256 amountOutMinimum)) payable returns (uint256 amountOut)',
  'function multicall(uint256 deadline, bytes[] data) payable returns (bytes[] results)',
  'function refundETH() payable',
  'function unwrapWETH9(uint256 amountMinimum, address recipient) payable',
];

const QUOTER_ABI = [
  'function quoteExactInputSingle((address tokenIn,address tokenOut,uint256 amountIn,uint24 fee,uint160 sqrtPriceLimitX96)) returns (uint256 amountOut,uint160,uint32,uint256)',
  'function quoteExactInput(bytes path, uint256 amountIn) returns (uint256 amountOut, uint160[] sqrtPriceX96AfterList, uint32[] initializedTicksCrossedList, uint256 gasEstimate)',
];

const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
];

const FEE_TIERS = [500, 3000, 10000, 100];

function encodePath(tokens, fees) {
  // tokens: [A, B, C], fees: [feeAB, feeBC]
  let path = '0x';
  for (let i = 0; i < fees.length; i += 1) {
    path += tokens[i].slice(2);
    path += Number(fees[i]).toString(16).padStart(6, '0');
  }
  path += tokens[tokens.length - 1].slice(2);
  return path.toLowerCase();
}

/**
 * Uniswap V3 swaps on Ethereum mainnet — tokenized stock buys/sells with ETH.
 * Supports direct WETH pools and multi-hop WETH→USDC→stock.
 */
export class TradingService {
  constructor(chain) {
    this.chain = chain;
    this.provider = new ethers.JsonRpcProvider(chain.rpcUrl, {
      chainId: chain.chainId,
      name: chain.name || 'ethereum',
    });
    this.router = new ethers.Contract(chain.uniswapV3Router, ROUTER_ABI, this.provider);
    this.quoter = new ethers.Contract(chain.uniswapV3Quoter, QUOTER_ABI, this.provider);
    this.weth = chain.weth;
    this.usdc = chain.usdc;
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
    const gasLimit = 450_000n;
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
      gasPrice: fee.gasPrice ?? 20_000_000_000n,
      ...extra,
    };
  }

  formatTxError(err) {
    const msg = err?.shortMessage || err?.reason || err?.message || 'transaction failed';
    if (/insufficient funds/i.test(msg)) {
      return 'need more ETH for gas on Ethereum mainnet — L1 fees are higher than L2';
    }
    if (/nonce/i.test(msg)) return `${msg} — retrying next tick`;
    if (/slippage|STF|INSUFFICIENT_OUTPUT|Too little received/i.test(msg)) {
      return `${msg} — stock pool moved or thin liquidity, will retry`;
    }
    if (/transfer|whitelist|compliance|paused/i.test(msg)) {
      return `${msg} — token may require KYC / allowlist`;
    }
    return msg.slice(0, 200);
  }

  /** Try single-hop WETH↔token across fee tiers. */
  async quoteWethHop(tokenAddress, amountIn, buying) {
    let best = null;
    for (const fee of FEE_TIERS) {
      try {
        const params = buying
          ? { tokenIn: this.weth, tokenOut: tokenAddress, amountIn, fee, sqrtPriceLimitX96: 0 }
          : { tokenIn: tokenAddress, tokenOut: this.weth, amountIn, fee, sqrtPriceLimitX96: 0 };
        const out = await this.quoter.quoteExactInputSingle.staticCall(params);
        const amountOut = out[0];
        if (amountOut > 0n && (!best || amountOut > best.amountOut)) {
          best = { amountOut, fee, routeType: 'weth' };
        }
      } catch { /* no pool */ }
    }
    return best;
  }

  /** Multi-hop WETH→USDC→token (or reverse). */
  async quoteUsdcHop(tokenAddress, amountIn, buying) {
    let best = null;
    const wethUsdcFees = [500, 3000];
    const usdcStockFees = [500, 3000, 10000];
    for (const f1 of wethUsdcFees) {
      for (const f2 of usdcStockFees) {
        try {
          const path = buying
            ? encodePath([this.weth, this.usdc, tokenAddress], [f1, f2])
            : encodePath([tokenAddress, this.usdc, this.weth], [f2, f1]);
          const out = await this.quoter.quoteExactInput.staticCall(path, amountIn);
          const amountOut = out[0];
          if (amountOut > 0n && (!best || amountOut > best.amountOut)) {
            best = { amountOut, fee: f2, feeHop: f1, routeType: 'usdc', path };
          }
        } catch { /* no path */ }
      }
    }
    return best;
  }

  async quoteBest(tokenAddress, amountIn, pools, buying) {
    const prefer = pools?.[0]?.routeType;
    let best = null;
    if (prefer !== 'usdc') {
      best = await this.quoteWethHop(tokenAddress, amountIn, buying);
    }
    const viaUsdc = await this.quoteUsdcHop(tokenAddress, amountIn, buying);
    if (viaUsdc && (!best || viaUsdc.amountOut > best.amountOut)) best = viaUsdc;
    if (!best && prefer === 'usdc') {
      best = await this.quoteWethHop(tokenAddress, amountIn, buying);
    }
    return best;
  }

  async quoteEthForToken(tokenAddress, ethAmount, pools) {
    const value = ethers.parseEther(String(Math.max(ethAmount, 0.00001)));
    const best = await this.quoteBest(tokenAddress, value, pools, true);
    return best?.amountOut ?? 0n;
  }

  async canSwapEthForToken(tokenAddress, ethAmount, pools, minOut = 0n) {
    try {
      const out = await this.quoteEthForToken(tokenAddress, ethAmount, pools);
      return out > 0n && out >= minOut;
    } catch {
      return false;
    }
  }

  async buyToken({ wallet, mintAddress, ethAmount, pools, minOut = 0n }) {
    const value = ethers.parseEther(String(ethAmount));
    const best = await this.quoteBest(mintAddress, value, pools, true);
    if (!best) throw new Error('no Uniswap V3 route with liquidity for this stock token');
    if (best.amountOut < minOut) throw new Error('quote below fair-price floor — skipping thin/mispriced pool');
    const amountOutMin = (best.amountOut * 90n) / 100n;

    const signer = wallet.connect(this.provider);
    const router = this.router.connect(signer);
    const deadline = Math.floor(Date.now() / 1000) + 300;
    const overrides = await this.buildTxOverrides({ value });

    let tx;
    if (best.routeType === 'weth') {
      const data = router.interface.encodeFunctionData('exactInputSingle', [{
        tokenIn: this.weth,
        tokenOut: mintAddress,
        fee: best.fee,
        recipient: wallet.address,
        amountIn: value,
        amountOutMinimum: amountOutMin,
        sqrtPriceLimitX96: 0n,
      }]);
      tx = await router.multicall(deadline, [data], overrides);
    } else {
      const data = router.interface.encodeFunctionData('exactInput', [{
        path: best.path,
        recipient: wallet.address,
        amountIn: value,
        amountOutMinimum: amountOutMin,
      }]);
      tx = await router.multicall(deadline, [data], overrides);
    }

    const receipt = await tx.wait();
    if (!receipt || receipt.status !== 1) throw new Error('buy transaction reverted on-chain');
    return {
      signature: receipt.hash,
      ethAmount: Number(ethAmount),
      solAmount: Number(ethAmount),
      explorerUrl: txExplorerUrl(this.explorerUrl, receipt.hash),
    };
  }

  async sellToken({ wallet, mintAddress, pools }) {
    const token = new ethers.Contract(mintAddress, ERC20_ABI, wallet.connect(this.provider));
    const balance = await token.balanceOf(wallet.address);
    if (balance === 0n) return null;

    const best = await this.quoteBest(mintAddress, balance, pools, false);
    if (!best) throw new Error('no Uniswap V3 route to sell this stock token');
    const amountOutMin = (best.amountOut * 90n) / 100n;

    const allowance = await token.allowance(wallet.address, this.chain.uniswapV3Router);
    if (allowance < balance) {
      const approveTx = await token.approve(this.chain.uniswapV3Router, ethers.MaxUint256, await this.buildTxOverrides());
      const approveReceipt = await approveTx.wait();
      if (!approveReceipt || approveReceipt.status !== 1) throw new Error('token approve reverted');
    }

    const router = this.router.connect(wallet.connect(this.provider));
    const deadline = Math.floor(Date.now() / 1000) + 300;
    const iface = router.interface;

    let swapData;
    if (best.routeType === 'weth') {
      swapData = iface.encodeFunctionData('exactInputSingle', [{
        tokenIn: mintAddress,
        tokenOut: this.weth,
        fee: best.fee,
        recipient: this.chain.uniswapV3Router,
        amountIn: balance,
        amountOutMinimum: amountOutMin,
        sqrtPriceLimitX96: 0n,
      }]);
    } else {
      swapData = iface.encodeFunctionData('exactInput', [{
        path: best.path,
        recipient: this.chain.uniswapV3Router,
        amountIn: balance,
        amountOutMinimum: amountOutMin,
      }]);
    }
    const unwrapData = iface.encodeFunctionData('unwrapWETH9', [amountOutMin, wallet.address]);
    const tx = await router.multicall(deadline, [swapData, unwrapData], await this.buildTxOverrides());
    const receipt = await tx.wait();
    if (!receipt || receipt.status !== 1) throw new Error('sell transaction reverted on-chain');

    return {
      signature: receipt.hash,
      ethAmount: Number(ethers.formatEther(best.amountOut)),
      solAmount: Number(ethers.formatEther(best.amountOut)),
      explorerUrl: txExplorerUrl(this.explorerUrl, receipt.hash),
    };
  }
}
