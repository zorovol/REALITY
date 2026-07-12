import { ethers } from 'ethers';
import { txExplorerUrl } from '../chain/robinhood.js';

const ROUTER_ABI = [
  'function swapExactETHForTokens(uint256 amountOutMin, address[] calldata path, address to, uint256 deadline) payable returns (uint256[] memory amounts)',
  'function swapExactTokensForETH(uint256 amountIn, uint256 amountOutMin, address[] calldata path, address to, uint256 deadline) returns (uint256[] memory amounts)',
  'function getAmountsOut(uint256 amountIn, address[] calldata path) view returns (uint256[] memory amounts)',
];

const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
];

/** Uniswap V2 swaps on Robinhood Chain — memecoin buys/sells with ETH. */
export class TradingService {
  /**
   * @param {{ rpcUrl: string, chainId: number, weth: string, router: string, explorerUrl: string }} chain
   */
  constructor(chain) {
    this.chain = chain;
    this.provider = new ethers.JsonRpcProvider(chain.rpcUrl, {
      chainId: chain.chainId,
      name: chain.name || 'robinhood',
    });
    this.router = new ethers.Contract(chain.uniswapV2Router, ROUTER_ABI, this.provider);
    this.weth = chain.weth;
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
    const gasLimit = 800_000n;
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
    if (/slippage|STF|INSUFFICIENT_OUTPUT/i.test(msg)) {
      return `${msg} — memecoin moved too fast, will retry`;
    }
    return msg.slice(0, 200);
  }

  async canSwapEthForToken(tokenAddress, ethAmount) {
    try {
      const path = [this.weth, tokenAddress];
      const value = ethers.parseEther(String(Math.max(ethAmount, 0.00001)));
      const amounts = await this.router.getAmountsOut(value, path);
      return amounts[1] > 0n;
    } catch {
      return false;
    }
  }

  async buyToken({ wallet, mintAddress, ethAmount }) {
    const path = [this.weth, mintAddress];
    const deadline = Math.floor(Date.now() / 1000) + 600;
    const value = ethers.parseEther(String(ethAmount));
    const amounts = await this.router.getAmountsOut(value, path);
    const amountOutMin = (amounts[1] * 80n) / 100n; // 20% slippage for volatile memecoins

    const signer = wallet.connect(this.provider);
    const router = this.router.connect(signer);
    const tx = await router.swapExactETHForTokens(
      amountOutMin,
      path,
      wallet.address,
      deadline,
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

    const routerAddr = this.chain.uniswapV2Router;
    const allowance = await token.allowance(wallet.address, routerAddr);
    if (allowance < balance) {
      const approveTx = await token.approve(routerAddr, ethers.MaxUint256, await this.buildTxOverrides());
      const approveReceipt = await approveTx.wait();
      if (!approveReceipt || approveReceipt.status !== 1) {
        throw new Error('token approve reverted on-chain');
      }
    }

    const path = [mintAddress, this.weth];
    const deadline = Math.floor(Date.now() / 1000) + 600;
    const targetWei = ethers.parseEther(String(Math.max(targetEth, 0.00001)));
    let amountIn = balance;

    try {
      const amounts = await this.router.getAmountsOut(amountIn, path);
      if (amounts[1] < targetWei && amountIn > 1n) {
        amountIn = (amountIn * targetWei) / amounts[1];
      }
    } catch {
      /* sell full balance */
    }

    const amountsOut = await this.router.getAmountsOut(amountIn, path);
    const amountOutMin = (amountsOut[1] * 85n) / 100n; // 15% slippage on sells

    const router = this.router.connect(wallet.connect(this.provider));
    const tx = await router.swapExactTokensForETH(
      amountIn,
      amountOutMin,
      path,
      wallet.address,
      deadline,
      await this.buildTxOverrides(),
    );
    const receipt = await tx.wait();
    if (!receipt || receipt.status !== 1) {
      throw new Error('sell transaction reverted on-chain');
    }
    const ethOut = Number(ethers.formatEther(amountsOut[1] ?? 0n));

    return {
      signature: receipt.hash,
      ethAmount: ethOut,
      solAmount: ethOut,
      explorerUrl: txExplorerUrl(this.explorerUrl, receipt.hash),
    };
  }
}
