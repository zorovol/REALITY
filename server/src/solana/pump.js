import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
  ComputeBudgetProgram,
} from '@solana/web3.js';
import { getAssociatedTokenAddress, getAccount, TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import {
  PumpSdk,
  OnlinePumpSdk,
  getBuyTokenAmountFromSolAmount,
  getSellSolAmountFromTokenAmount,
} from '@pump-fun/pump-sdk';
import BN from 'bn.js';
import { LAMPORTS_PER_SOL, solanaConfig, solscanTxUrl } from './config.js';

const SLIPPAGE = 5;

export class PumpService {
  constructor(rpcUrl) {
    this.connection = new Connection(rpcUrl, 'confirmed');
    this.online = new OnlinePumpSdk(this.connection);
    this.sdk = new PumpSdk();
    this.globalCache = null;
    this.globalCacheAt = 0;
    this.feeConfigCache = null;
    this.feeConfigCacheAt = 0;
  }

  async getGlobal() {
    const now = Date.now();
    if (this.globalCache && now - this.globalCacheAt < 60_000) return this.globalCache;
    this.globalCache = await this.online.fetchGlobal();
    this.globalCacheAt = now;
    return this.globalCache;
  }

  async getFeeConfig() {
    const now = Date.now();
    if (this.feeConfigCache && now - this.feeConfigCacheAt < 60_000) return this.feeConfigCache;
    this.feeConfigCache = await this.online.fetchFeeConfig();
    this.feeConfigCacheAt = now;
    return this.feeConfigCache;
  }

  async getTradeContext() {
    const [global, feeConfig] = await Promise.all([this.getGlobal(), this.getFeeConfig()]);
    return { global, feeConfig };
  }

  calcBuyAmount(global, feeConfig, bondingCurve, solBn) {
    return getBuyTokenAmountFromSolAmount({
      global,
      feeConfig,
      mintSupply: bondingCurve?.tokenTotalSupply ?? null,
      bondingCurve,
      amount: solBn,
      quoteMint: bondingCurve?.quoteMint ?? PublicKey.default,
    });
  }

  calcSellAmount(global, feeConfig, bondingCurve, tokenAmount) {
    return getSellSolAmountFromTokenAmount({
      global,
      feeConfig,
      mintSupply: bondingCurve.tokenTotalSupply,
      bondingCurve,
      amount: tokenAmount,
    });
  }

  async getMintTokenProgram(mint) {
    const info = await this.connection.getAccountInfo(mint);
    if (!info) throw new Error(`Mint account not found: ${mint.toBase58()}`);
    return info.owner.equals(TOKEN_2022_PROGRAM_ID) ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID;
  }

  async sendInstructions(keypair, instructions, label = 'tx') {
    const tx = new Transaction();
    tx.add(
      ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50_000 }),
      ...instructions,
    );
    const signature = await sendAndConfirmTransaction(
      this.connection,
      tx,
      [keypair],
      { commitment: 'confirmed', skipPreflight: false },
    );
    console.log(`[pump] ${label} confirmed: ${signature}`);
    return { signature, explorerUrl: solscanTxUrl(signature) };
  }

  tokenSymbol(agentName) {
    const clean = agentName.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    return clean.slice(0, 6) || 'ISLAND';
  }

  tokenMetadataUri(agent) {
    const payload = {
      name: `${agent.name} Island`,
      symbol: this.tokenSymbol(agent.name),
      description: `GPTGrokGeminiDeepSeekFable castaway coin — ${agent.tagline ?? agent.name}`,
      image: '',
      showName: 'GPTGrokGeminiDeepSeekFable',
      createdOn: 'https://pump.fun',
    };
    const encoded = Buffer.from(JSON.stringify(payload)).toString('base64');
    return `data:application/json;base64,${encoded}`;
  }

  async launchIslandToken({ agent, keypair, solAmount }) {
    const mint = Keypair.generate();
    const { global, feeConfig } = await this.getTradeContext();
    const solBn = new BN(Math.floor(solAmount * LAMPORTS_PER_SOL));
    const amount = this.calcBuyAmount(global, feeConfig, null, solBn);

    const instructions = await this.sdk.createAndBuyInstructions({
      global,
      mint: mint.publicKey,
      name: `${agent.name} Island`,
      symbol: this.tokenSymbol(agent.name),
      uri: this.tokenMetadataUri(agent),
      creator: keypair.publicKey,
      user: keypair.publicKey,
      solAmount: solBn,
      amount,
    });

    const tx = new Transaction();
    tx.add(
      ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50_000 }),
      ...instructions,
    );
    const sig = await sendAndConfirmTransaction(
      this.connection,
      tx,
      [keypair, mint],
      { commitment: 'confirmed' },
    );
    console.log(`[pump] launch $${this.tokenSymbol(agent.name)} confirmed: ${sig}`);

    return {
      mint: mint.publicKey.toBase58(),
      symbol: this.tokenSymbol(agent.name),
      signature: sig,
      explorerUrl: solscanTxUrl(sig),
      solAmount,
    };
  }

  async buyToken({ keypair, mintAddress, solAmount }) {
    const mint = new PublicKey(mintAddress);
    const user = keypair.publicKey;
    const tokenProgram = await this.getMintTokenProgram(mint);
    const { global, feeConfig } = await this.getTradeContext();
    const { bondingCurveAccountInfo, bondingCurve, associatedUserAccountInfo } =
      await this.online.fetchBuyState(mint, user, tokenProgram);
    const solBn = new BN(Math.floor(solAmount * LAMPORTS_PER_SOL));
    const amount = this.calcBuyAmount(global, feeConfig, bondingCurve, solBn);

    const instructions = await this.sdk.buyInstructions({
      global,
      bondingCurveAccountInfo,
      bondingCurve,
      associatedUserAccountInfo,
      mint,
      user,
      solAmount: solBn,
      amount,
      slippage: SLIPPAGE,
      tokenProgram,
    });

    const { signature, explorerUrl } = await this.sendInstructions(
      keypair,
      instructions,
      `buy ${mintAddress.slice(0, 8)}`,
    );
    return { signature, explorerUrl, solAmount, side: 'buy' };
  }

  async sellToken({ keypair, mintAddress, sellRatio = 0.5 }) {
    const mint = new PublicKey(mintAddress);
    const user = keypair.publicKey;
    const tokenProgram = await this.getMintTokenProgram(mint);
    const ata = await getAssociatedTokenAddress(mint, user, false, tokenProgram);
    let tokenBalance;
    try {
      const acct = await getAccount(this.connection, ata, undefined, tokenProgram);
      tokenBalance = acct.amount;
    } catch {
      return null;
    }
    if (tokenBalance <= 0n) return null;

    const sellAmount = new BN(
      (BigInt(tokenBalance.toString()) * BigInt(Math.floor(sellRatio * 100)) / 100n).toString(),
    );
    if (sellAmount.lte(new BN(0))) return null;

    const { global, feeConfig } = await this.getTradeContext();
    const { bondingCurveAccountInfo, bondingCurve } = await this.online.fetchSellState(mint, user, tokenProgram);
    const solAmount = this.calcSellAmount(global, feeConfig, bondingCurve, sellAmount);

    const instructions = await this.sdk.sellInstructions({
      global,
      bondingCurveAccountInfo,
      bondingCurve,
      mint,
      user,
      amount: sellAmount,
      solAmount,
      slippage: SLIPPAGE,
      tokenProgram,
    });

    const { signature, explorerUrl } = await this.sendInstructions(
      keypair,
      instructions,
      `sell ${mintAddress.slice(0, 8)}`,
    );
    return {
      signature,
      explorerUrl,
      side: 'sell',
      solAmount: Number(solAmount.toString()) / LAMPORTS_PER_SOL,
    };
  }

  async getTokenBalance(keypair, mintAddress) {
    const raw = await this.getTokenBalanceRaw(keypair, mintAddress);
    return Number(raw) / 1_000_000;
  }

  async getTokenBalanceRaw(keypair, mintAddress) {
    try {
      const mint = new PublicKey(mintAddress);
      const tokenProgram = await this.getMintTokenProgram(mint);
      const ata = await getAssociatedTokenAddress(mint, keypair.publicKey, false, tokenProgram);
      const acct = await getAccount(this.connection, ata, undefined, tokenProgram);
      return acct.amount;
    } catch {
      return 0n;
    }
  }
}
