import * as anchor from '@project-serum/anchor';
import {PublicKey} from '@solana/web3.js';

export const MAX_ALLOWED_COUNT = 30;

export interface GlobalInfo {
    admin: PublicKey,               // 32
    whitelistedCount: anchor.BN,    // 8
    whitelist: PublicKey[],         // 32 * MAX_ALLOWED_COUNT
    active: anchor.BN,              // 8
}
