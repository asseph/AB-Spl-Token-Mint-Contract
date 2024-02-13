use anchor_lang::{
    prelude::*,
};
use anchor_spl::{
    token::{
        self,
        Token,
        TokenAccount,
        Mint,
        Transfer,
        FreezeAccount,
        ThawAccount,
        SetAuthority
    }
};
use spl_token::state::{AccountState};

pub mod account;
pub mod error;
pub mod constants;

use account::*;
use error::*;
use constants::*;

declare_id!("Ah9YbbS3KuYYoa26CuNMjzN6U4aBcu1ZgimSKeD7Q9zs");

#[program]
pub mod aiko_vesting {
    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        _global_bump: u8,
    ) -> ProgramResult {
        let global_authority = &mut ctx.accounts.global_authority;
        global_authority.admin = ctx.accounts.admin.key();
        global_authority.active = 1;
        msg!("SuperAdmin: {:?}", global_authority.admin.key());
        // Err(ProgramError::from(VestingError::InvalidSuperOwner))
        Ok(())
    }

    pub fn update_global_state(
        ctx: Context<UpdateGlobalState>,
        _global_bump: u8,
        new_admin: Option<Pubkey>,
        active_state: Option<u64>,
    ) -> ProgramResult {
        let global_authority = &mut ctx.accounts.global_authority;
 
        require!(ctx.accounts.admin.key() == global_authority.admin, VestingError::InvalidSuperOwner);

        if let Some(new_super_admin) = new_admin {
            msg!("Super Admin Changed to {:?}", new_super_admin);
            global_authority.admin = new_super_admin;
        }
        if let Some(new_active) = active_state {
            msg!("Active State Changed to {:?}", new_active);
            global_authority.active = new_active;
        }
        Ok(())
    }

    pub fn add_to_whitelist(
        ctx: Context<AddToWhitelist>,
        _global_bump: u8,
        address: Pubkey,
    ) -> ProgramResult {
        let global_authority = &mut ctx.accounts.global_authority;
        
        require!(global_authority.active == 1, VestingError::VestingDeactived);
        require!(ctx.accounts.admin.key() == global_authority.admin, VestingError::InvalidSuperOwner);
        msg!("Add {:?} to whitelist", address);

        let count: usize = global_authority.whitelisted_count as usize;
        let mut exist: u8 = 0;
        for idx in 0..count {
            if global_authority.whitelist[idx as usize] == address {
                exist = 1;
                break;
            }
        }

        if exist == 0 {
            global_authority.whitelist[count] = address;
            global_authority.whitelisted_count += 1;
        }
        Ok(())
    }
    
    pub fn remove_from_whitelist(
        ctx: Context<RemoveFromWhitelist>,
        _global_bump: u8,
        address: Pubkey,
    ) -> ProgramResult {
        let global_authority = &mut ctx.accounts.global_authority;
 
        require!(global_authority.active == 1, VestingError::VestingDeactived);
        require!(ctx.accounts.admin.key() == global_authority.admin, VestingError::InvalidSuperOwner);
        msg!("Remove {:?} from whitelist", address);

        let count: usize = global_authority.whitelisted_count as usize;
        let mut index: usize = 0;
        let mut exist: u8 = 0;
        for idx in 0..count {
            if global_authority.whitelist[idx as usize] == address {
                exist = 1;
                index = idx;
                break;
            }
        }

        require!(exist == 1, VestingError::InvalidWhitelistAddress);

        if index != count - 1 {
            global_authority.whitelist[index] = global_authority.whitelist[count - 1];
        }
        global_authority.whitelisted_count -= 1;

        Ok(())
    }

    pub fn transfer_freeze_authority(
        ctx: Context<TransferAuthority>,
        // address: Pubkey,
        global_bump: u8,
    ) -> ProgramResult {
        let global_authority = &mut ctx.accounts.global_authority;
        let new_authority = &mut ctx.accounts.new_authority;
        require!(ctx.accounts.admin.key() == global_authority.admin, VestingError::InvalidSuperOwner);
        
        msg!("Transfer freezeAuthority: {:?}", new_authority);
        
        let vesting_token = &mut ctx.accounts.vesting_token;
        let token_program = &mut ctx.accounts.token_program;

        let seeds = &[GLOBAL_AUTHORITY_SEED.as_bytes(), &[global_bump]];
        let signer = &[&seeds[..]];
        let cpi_accounts = SetAuthority {
            current_authority: global_authority.to_account_info().clone(),
            account_or_mint: vesting_token.to_account_info().clone(),
        };

        token::set_authority(
            CpiContext::new_with_signer(token_program.clone().to_account_info(), cpi_accounts, signer),
            spl_token::instruction::AuthorityType::FreezeAccount,
            Some(new_authority.key()),
        )?;

        

        // Err(ProgramError::from(VestingError::InvalidSuperOwner))
        Ok(())
    }
    
    pub fn freeze_token_account(
        ctx: Context<FreezeTokenAccount>,
        global_bump: u8,
    ) -> ProgramResult {
        let global_authority = &mut ctx.accounts.global_authority;
        let user_token_account = &mut ctx.accounts.user_token_account;
        
        if global_authority.active == 1 {
            msg!("Freeze is deactivated");
            return Ok(());
        };
        
        msg!("Freeze user token account: {:?}", user_token_account.key());
        
        let vesting_token = &mut ctx.accounts.vesting_token;
        let token_program = &mut ctx.accounts.token_program;

        let seeds = &[GLOBAL_AUTHORITY_SEED.as_bytes(), &[global_bump]];
        let signer = &[&seeds[..]];
        let cpi_accounts = FreezeAccount {
            account: user_token_account.to_account_info().clone(),
            mint: vesting_token.to_account_info().clone(),
            authority: global_authority.to_account_info().clone(),
        };

        token::freeze_account(
            CpiContext::new_with_signer(token_program.clone().to_account_info(), cpi_accounts, signer)
        )?;

        // Err(ProgramError::from(VestingError::InvalidSuperOwner))
        Ok(())
    }
    
    pub fn thaw_token_account(
        ctx: Context<ThawTokenAccount>,
        global_bump: u8,
    ) -> ProgramResult {
        let global_authority = &mut ctx.accounts.global_authority;
        let applicant = &mut ctx.accounts.applicant;

        msg!("Thaw request by: {:?}", applicant.key());

        let mut allowed: u8 = 0;
        let count: usize = global_authority.whitelisted_count as usize;
        for idx in 0..count {
            if global_authority.whitelist[idx] == applicant.key() {
                allowed = 1;
                break;
            }
        }

        if global_authority.active == 1 {
            require!(allowed == 1, VestingError::NotAllowedApplicant);
        }

        let user_token_account = &mut ctx.accounts.user_token_account;
        
        msg!("Token account: {:?}", user_token_account.key());
        
        let vesting_token = &mut ctx.accounts.vesting_token;
        let token_program = &mut ctx.accounts.token_program;

        let seeds = &[GLOBAL_AUTHORITY_SEED.as_bytes(), &[global_bump]];
        let signer = &[&seeds[..]];
        let cpi_accounts = ThawAccount {
            account: user_token_account.to_account_info().clone(),
            mint: vesting_token.to_account_info().clone(),
            authority: global_authority.to_account_info().clone(),
        };

        token::thaw_account(
            CpiContext::new_with_signer(token_program.clone().to_account_info(), cpi_accounts, signer)
        )?;

        // Err(ProgramError::from(VestingError::InvalidSuperOwner))
        Ok(())
    }
    
    pub fn transfer_with_unlock(
        ctx: Context<TransferWithUnlock>,
        global_bump: u8,
        amount: u64,
    ) -> ProgramResult {
        let global_authority = &mut ctx.accounts.global_authority;
        let applicant = &mut ctx.accounts.applicant;
        let dest_token_account = &mut ctx.accounts.dest_token_account;
        let user_token_account = &mut ctx.accounts.user_token_account;

        msg!("User token account: {:?} {:?} {:#?}",
            user_token_account.key(),
            user_token_account.owner,
            user_token_account.state
        );
        msg!("Dest token account: {:?} {:?} {:#?}",
            dest_token_account.key(),
            dest_token_account.owner,
            dest_token_account.state
        );
        msg!("Transfer request by: {:?}", applicant.key());

        let mut allowed: u8 = 0;
        let count: usize = global_authority.whitelisted_count as usize;

        for idx in 0..count {
            // Allowed caller
            if global_authority.whitelist[idx] == applicant.key() {
                allowed = 1;
                break;
            }
            // Allowed Owner for source token account
            if global_authority.whitelist[idx] == user_token_account.owner {
                allowed = 1;
                break;
            }
            // Allowed token account
            if global_authority.whitelist[idx] == user_token_account.key() {
                allowed = 1;
                break;
            }
            // Allowed Owner for destination token account
            if global_authority.whitelist[idx] == dest_token_account.owner {
                allowed = 1;
                break;
            }
            // Allowed token account
            if global_authority.whitelist[idx] == dest_token_account.key() {
                allowed = 1;
                break;
            }
        }
        
        if global_authority.active == 1 {
            if user_token_account.state == AccountState::Frozen
                || dest_token_account.state == AccountState::Frozen {
                    require!(allowed == 1, VestingError::NotAllowedApplicant);
                }
        }

        let vesting_token = &mut ctx.accounts.vesting_token;
        let token_program = &mut ctx.accounts.token_program;

        let seeds = &[GLOBAL_AUTHORITY_SEED.as_bytes(), &[global_bump]];
        let signer = &[&seeds[..]];
            
        if user_token_account.state == AccountState::Frozen {
            let cpi_accounts = ThawAccount {
                account: user_token_account.to_account_info().clone(),
                mint: vesting_token.to_account_info().clone(),
                authority: global_authority.to_account_info().clone(),
            };

            token::thaw_account(
                CpiContext::new_with_signer(token_program.clone().to_account_info(), cpi_accounts, signer)
            )?;
        }
        if dest_token_account.state == AccountState::Frozen {
            let cpi_accounts = ThawAccount {
                account: dest_token_account.to_account_info().clone(),
                mint: vesting_token.to_account_info().clone(),
                authority: global_authority.to_account_info().clone(),
            };

            token::thaw_account(
                CpiContext::new_with_signer(token_program.clone().to_account_info(), cpi_accounts, signer)
            )?;
        }

        let cpi_accounts = Transfer {
            from: user_token_account.to_account_info().clone(),
            to: dest_token_account.to_account_info().clone(),
            authority: applicant.to_account_info().clone(),
        };

        token::transfer(
            CpiContext::new(token_program.clone().to_account_info(), cpi_accounts),
            amount
        )?;

        if global_authority.active == 1 {
            if user_token_account.state == AccountState::Frozen {
                let cpi_accounts = FreezeAccount {
                    account: user_token_account.to_account_info().clone(),
                    mint: vesting_token.to_account_info().clone(),
                    authority: global_authority.to_account_info().clone(),
                };

                token::freeze_account(
                    CpiContext::new_with_signer(token_program.clone().to_account_info(), cpi_accounts, signer)
                )?;
            }
            if dest_token_account.state == AccountState::Frozen {
                let cpi_accounts = FreezeAccount {
                    account: dest_token_account.to_account_info().clone(),
                    mint: vesting_token.to_account_info().clone(),
                    authority: global_authority.to_account_info().clone(),
                };

                token::freeze_account(
                    CpiContext::new_with_signer(token_program.clone().to_account_info(), cpi_accounts, signer)
                )?;
            }
        }
        // Err(ProgramError::from(VestingError::InvalidSuperOwner))
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(global_bump: u8)]
pub struct Initialize<'info> {
    #[account(
        init,
        seeds = [GLOBAL_AUTHORITY_SEED.as_ref()],
        bump = global_bump,
        payer = admin
    )]
    pub global_authority: Box<Account<'info, GlobalInfo>>,

    #[account(mut)]
    pub admin: Signer<'info>,
    
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>
}

#[derive(Accounts)]
#[instruction(global_bump: u8)]
pub struct UpdateGlobalState<'info> {
    #[account(
        mut,
        seeds = [GLOBAL_AUTHORITY_SEED.as_ref()],
        bump = global_bump,
    )]
    pub global_authority: Box<Account<'info, GlobalInfo>>,

    #[account(mut)]
    pub admin: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(global_bump: u8)]
pub struct AddToWhitelist<'info> {
    #[account(
        mut,
        seeds = [GLOBAL_AUTHORITY_SEED.as_ref()],
        bump = global_bump,
    )]
    pub global_authority: Box<Account<'info, GlobalInfo>>,

    #[account(mut)]
    pub admin: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(global_bump: u8)]
pub struct RemoveFromWhitelist<'info> {
    #[account(
        mut,
        seeds = [GLOBAL_AUTHORITY_SEED.as_ref()],
        bump = global_bump,
    )]
    pub global_authority: Box<Account<'info, GlobalInfo>>,

    #[account(mut)]
    pub admin: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(global_bump: u8)]
pub struct TransferAuthority<'info> {
    #[account(
        mut,
        seeds = [GLOBAL_AUTHORITY_SEED.as_ref()],
        bump = global_bump,
    )]
    pub global_authority: Box<Account<'info, GlobalInfo>>,

    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        mut,
        constraint = vesting_token.key() == VESTING_TOKEN_MINT_PUBKEY.parse::<Pubkey>().unwrap(),
    )]
    pub vesting_token: Box<Account<'info, Mint>>,

    #[account(mut)]
    pub new_authority: AccountInfo<'info>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
#[instruction(global_bump: u8)]
pub struct FreezeTokenAccount<'info> {
    #[account(
        mut,
        seeds = [GLOBAL_AUTHORITY_SEED.as_ref()],
        bump = global_bump,
    )]
    pub global_authority: Box<Account<'info, GlobalInfo>>,

    #[account(
        mut,
        constraint = vesting_token.key() == VESTING_TOKEN_MINT_PUBKEY.parse::<Pubkey>().unwrap(),
    )]
    pub vesting_token: Box<Account<'info, Mint>>,

    #[account(
        mut,
        constraint = user_token_account.mint == vesting_token.key(),
    )]
    pub user_token_account: Box<Account<'info, TokenAccount>>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
#[instruction(global_bump: u8)]
pub struct ThawTokenAccount<'info> {
    #[account(mut)]
    pub applicant: Signer<'info>,

    #[account(
        mut,
        seeds = [GLOBAL_AUTHORITY_SEED.as_ref()],
        bump = global_bump,
    )]
    pub global_authority: Box<Account<'info, GlobalInfo>>,

    #[account(mut)]
    pub vesting_token: Box<Account<'info, Mint>>,

    #[account(
        mut,
        constraint = user_token_account.mint == vesting_token.key(),
    )]
    pub user_token_account: Box<Account<'info, TokenAccount>>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
#[instruction(global_bump: u8, amount: u64)]
pub struct TransferWithUnlock<'info> {
    #[account(mut)]
    pub applicant: Signer<'info>,

    #[account(
        mut,
        seeds = [GLOBAL_AUTHORITY_SEED.as_ref()],
        bump = global_bump,
    )]
    pub global_authority: Box<Account<'info, GlobalInfo>>,

    #[account(
        mut,
        constraint = vesting_token.key() == VESTING_TOKEN_MINT_PUBKEY.parse::<Pubkey>().unwrap(),
    )]
    pub vesting_token: Box<Account<'info, Mint>>,

    #[account(
        mut,
        constraint = user_token_account.mint == vesting_token.key(),
        constraint = user_token_account.amount >= amount,
    )]
    pub user_token_account: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        constraint = user_token_account.mint == vesting_token.key(),
    )]
    pub dest_token_account: Box<Account<'info, TokenAccount>>,

    pub token_program: Program<'info, Token>,
}
