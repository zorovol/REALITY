import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const anchor = require('@coral-xyz/anchor');

export default anchor;
export const BN = anchor.BN;
export const AnchorProvider = anchor.AnchorProvider;
export const Program = anchor.Program;
