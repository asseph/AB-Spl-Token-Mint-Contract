use anchor_lang::prelude::*;

#[error]
pub enum VestingError {
    #[msg("Uninitialized account")]
    Uninitialized,
    #[msg("Invalid Super Owner")]
    InvalidSuperOwner,
    #[msg("Vesting is deactived. Allowed for all thaw and transfer action.")]
    VestingDeactived,
    #[msg("Invalid Whitelist Address")]
    InvalidWhitelistAddress,
    #[msg("The Applicant Not Allowed In Whitelist")]
    NotAllowedApplicant,
}