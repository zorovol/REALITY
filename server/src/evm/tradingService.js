import { ethers } from 'ethers';
import { txExplorerUrl } from '../chain/robinhood.js';

const ROUTER_V3_ABI = [
  'function exactInputSingle((address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 amountIn,uint256 amountOutMinimum,uint160 sqrtPriceLimitX96)) payable returns (uint256 amountOut)',
  'function multicall(bytes[] data) payable returns (bytes[] results)',
  'function unwrapWETH9(uint256 amountMinimum, address recipient) payable',
];

const QUOTER_ABI = [
  'function quoteExactInputSingle((address tokenIn,address tokenOut,uint256 amountIn,uint24 fee,uint160 sqrtPriceLimitX96)) returns (uint256 amountOut,uint160,uint32,uint256)',
];

const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
];

/** Uniswap V3 swaps on Robinhood Chain — launchpad memecoin buys/sells with ETH. */
export class TradingService {
  /**
   * @param {{ rpcUrl: string, chainId: number, weth: string, uniswapV3Router: string, uniswapV3Quoter: string, uniswapV3Fee: number, explorerUrl: string }} chain
   */
  constructor(chain) {
    this.chain = chain;
    this.provider = new ethers.JsonRpcProvider(chain.rpcUrl, {
      chainId: chain.chainId,
      name: chain.name || 'robinhood',
    });
    this.router = new ethers.Contract(chain.uniswapV3Router, ROUTER_V3_ABI, this.provider);
    this.quoter = new ethers.Contract(chain.uniswapV3Quoter, QUOTER_ABI, this.provider);
    this.weth = chain.weth;
    this.v3Fee = chain.uniswapV3Fee ?? 10000;
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
      return `${msg} — fund ETH on Robinhood Chain (chain ID 4663), not Ethereum L1`;
    }
    if (/nonce/i.test(msg)) return `${msg} — retrying next tick`;
    if (/slippage|STF|INSUFFICIENT_OUTPUT|TF/i.test(msg)) {
      return `${msg} — memecoin moved too fast or still on bonding curve, will retry`;
    }
    return msg.slice(0, 200);
  }

  async quoteEthForToken(tokenAddress, ethAmount) {
    const value = ethers.parseEther(String(Math.max(ethAmount, 0.00001)));
    const out = await this.quoter.quoteExactInputSingle.staticCall({
      tokenIn: this.weth,
      tokenOut: tokenAddress,
      amountIn: value,
      fee: this.v3Fee,
      sqrtPriceLimitX96: 0,
    });
    return out[0];
  }

  async canSwapEthForToken(tokenAddress, ethAmount) {
    try {
      const out = await this.quoteEthForToken(tokenAddress, ethAmount);
      return out > 0n;
    } catch {
      return false;
    }
  }

  async buyToken({ wallet, mintAddress, ethAmount }) {
    const value = ethers.parseEther(String(ethAmount));
    const quoted = await this.quoteEthForToken(mintAddress, ethAmount);
    const amountOutMin = (quoted * 80n) / 100n; // 20% slippage

    const signer = wallet.connect(this.provider);
    const router = this.router.connect(signer);
    const tx = await router.exactInputSingle(
      {
        tokenIn: this.weth,
        tokenOut: mintAddress,
        fee: this.v3Fee,
        recipient: wallet.address,
        amountIn: value,
        amountOutMinimum: amountOutMin,
        sqrtPriceLimitX96: 0n,
      },
      { ...(await this.buildTxOverrides()), value },
    );
    const receipt = await tx.wait();
    if (!receipt || receipt.status !== 1) {
      throw new Error('buy transaction reverted on-chain');
    }
    return {
      signature: receipt.hash,
      ethAmount: Number(ethAmount),
      solAmount: Number(ethAmount),
      explorerUrl: txExplorerUrl(this.explorerUrl, receipt.hash),
    };
  }

  async sellToken({ wallet, mintAddress, targetEth }) {
    const token = new ethers.Contract(mintAddress, ERC20_ABI, wallet.connect(this.provider));
    const balance = await token.balanceOf(wallet.address);
    if (balance === 0n) return null;

    const routerAddr = this.chain.uniswapV3Router;
    const allowance = await token.allowance(wallet.address, routerAddr);
    if (allowance < balance) {
      const approveTx = await token.approve(routerAddr, ethers.MaxUint256, await this.buildTxOverrides());
      const approveReceipt = await approveTx.wait();
      if (!approveReceipt || approveReceipt.status !== 1) {
        throw new Error('token approve reverted on-chain');
      }
    }

    let amountIn = balance;
    const targetWei = ethers.parseEther(String(Math.max(targetEth, 0.00001)));
    try {
      const quoted = await this.quoter.quoteExactInputSingle.staticCall({
        tokenIn: mintAddress,
        tokenOut: this.weth,
        amountIn,
        fee: this.v3Fee,
        sqrtPriceLimitX96: 0,
      });
      if (quoted[0] < targetWei && amountIn > 1n) {
        amountIn = (amountIn * targetWei) / quoted[0];
      }
    } catch {
      /* sell full balance */
    }

    const quotedOut = await this.quoter.quoteExactInputSingle.staticCall({
      tokenIn: mintAddress,
      tokenOut: this.weth,
      amountIn,
      fee: this.v3Fee,
      sqrtPriceLimitX96: 0,
    });
    const amountOutMin = (quotedOut[0] * 85n) / 100n; // 15% slippage on sells

    const router = this.router.connect(wallet.connect(this.provider));
    const iface = router.interface;
    const swapData = iface.encodeFunctionData('exactInputSingle', [{
      tokenIn: mintAddress,
      tokenOut: this.weth,
      fee: this.v3Fee,
      recipient: routerAddr,
      amountIn,
      amountOutMinimum: amountOutMin,
      sqrtPriceLimitX96: 0n,
    }]);
    const unwrapData = iface.encodeFunctionData('unwrapWETH9', [amountOutMin, wallet.address]);

    const tx = await router.multicall([swapData, unwrapData], await this.buildTxOverrides());
    const receipt = await tx.wait();
    if (!receipt || receipt.status !== 1) {
      throw new Error('sell transaction reverted on-chain');
    }
    const ethOut = Number(ethers.formatEther(quotedOut[0] ?? 0n));

    return {
      signature: receipt.hash,
      ethAmount: ethOut,
      solAmount: ethOut,
      explorerUrl: txExplorerUrl(this.explorerUrl, receipt.hash),
    };
  }
}
