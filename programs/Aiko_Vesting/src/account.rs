use anchor_lang::prelude::*;
use crate::constants::*;

#[account]
pub struct GlobalInfo {
    // 8 + 1008
    pub admin: Pubkey,             // 32
    pub whitelisted_count: u64,    // 8
    pub whitelist: [Pubkey; MAX_ALLOWED_COUNT],   // 32 * 30
    pub active: u64,               // 8
}

impl Default for GlobalInfo {
    #[inline]
    fn default() -> GlobalInfo {
        GlobalInfo {
            admin: Pubkey::default(),
            whitelisted_count: 0,
            whitelist: [Pubkey::default(); MAX_ALLOWED_COUNT],
            active: 1,
        }
    }
}