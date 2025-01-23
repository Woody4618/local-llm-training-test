use anchor_lang::prelude::*;
use anchor_lang::solana_program::{program::invoke, system_instruction};

declare_id!("GToq12doLbjKo8zHRP2V89fS1krXa19AmwiRHBzT16NC");

#[program]
pub mod coinflip {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, house_fee: u8) -> Result<()> {
        require!(house_fee <= 100, CustomError::InvalidHouseFee);

        let house = &mut ctx.accounts.house;
        house.authority = ctx.accounts.authority.key();
        house.fee = house_fee;
        house.bump = *ctx.bumps.get("house").unwrap();

        Ok(())
    }

    pub fn place_bet(ctx: Context<PlaceBet>, bet_amount: u64) -> Result<()> {
        require!(bet_amount > 0, CustomError::InvalidBetAmount);

        let game = &mut ctx.accounts.game;
        let player = &ctx.accounts.player;

        // Transfer bet amount from player to game PDA
        invoke(
            &system_instruction::transfer(&player.key(), &game.key(), bet_amount),
            &[
                player.to_account_info(),
                game.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;

        game.player = player.key();
        game.bet_amount = bet_amount;
        game.bump = *ctx.bumps.get("game").unwrap();
        game.settled = false;

        Ok(())
    }

    pub fn flip_coin(ctx: Context<FlipCoin>) -> Result<()> {
        let game = &mut ctx.accounts.game;
        require!(!game.settled, CustomError::GameAlreadySettled);

        // Use recent blockhash as randomness source
        let recent_slot = Clock::get()?.slot;
        let is_heads = recent_slot % 2 == 0;

        let house_fee = ctx.accounts.house.fee as u64;
        let fee_amount = (game.bet_amount * house_fee as u64) / 100;
        let payout = game.bet_amount * 2 - fee_amount;

        if is_heads {
            // Player wins
            **ctx
                .accounts
                .game
                .to_account_info()
                .try_borrow_mut_lamports()? -= payout;
            **ctx.accounts.player.try_borrow_mut_lamports()? += payout;

            // Transfer fee to house
            **ctx
                .accounts
                .game
                .to_account_info()
                .try_borrow_mut_lamports()? -= fee_amount;
            **ctx
                .accounts
                .house
                .to_account_info()
                .try_borrow_mut_lamports()? += fee_amount;
        } else {
            // House wins
            **ctx
                .accounts
                .game
                .to_account_info()
                .try_borrow_mut_lamports()? -= game.bet_amount;
            **ctx
                .accounts
                .house
                .to_account_info()
                .try_borrow_mut_lamports()? += game.bet_amount;
        }

        game.settled = true;
        game.won = is_heads;

        Ok(())
    }

    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        let house = &ctx.accounts.house;
        let authority = &ctx.accounts.authority;

        require!(
            house.authority == authority.key(),
            CustomError::UnauthorizedWithdrawal
        );

        let house_lamports = **house.to_account_info().try_borrow_lamports()?;
        require!(amount <= house_lamports, CustomError::InsufficientFunds);

        **house.to_account_info().try_borrow_mut_lamports()? -= amount;
        **authority.try_borrow_mut_lamports()? += amount;

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = House::LEN,
        seeds = [b"house"],
        bump
    )]
    pub house: Account<'info, House>,

    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct PlaceBet<'info> {
    #[account(
        init,
        payer = player,
        space = Game::LEN,
        seeds = [b"game", player.key().as_ref()],
        bump
    )]
    pub game: Account<'info, Game>,

    #[account(mut)]
    pub player: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct FlipCoin<'info> {
    #[account(
        mut,
        seeds = [b"game", game.player.key().as_ref()],
        bump = game.bump,
    )]
    pub game: Account<'info, Game>,

    #[account(
        mut,
        seeds = [b"house"],
        bump = house.bump
    )]
    pub house: Account<'info, House>,

    #[account(mut)]
    pub player: SystemAccount<'info>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(
        mut,
        seeds = [b"house"],
        bump = house.bump
    )]
    pub house: Account<'info, House>,

    #[account(mut)]
    pub authority: Signer<'info>,
}

#[account]
pub struct House {
    pub authority: Pubkey,
    pub fee: u8,
    pub bump: u8,
}

#[account]
pub struct Game {
    pub player: Pubkey,
    pub bet_amount: u64,
    pub settled: bool,
    pub won: bool,
    pub bump: u8,
}

impl House {
    pub const LEN: usize = 8 + 32 + 1 + 1;
}

impl Game {
    pub const LEN: usize = 8 + 32 + 8 + 1 + 1 + 1;
}

#[error_code]
pub enum CustomError {
    #[msg("House fee must be between 0 and 100")]
    InvalidHouseFee,
    #[msg("Bet amount must be greater than 0")]
    InvalidBetAmount,
    #[msg("Game has already been settled")]
    GameAlreadySettled,
    #[msg("Unauthorized withdrawal attempt")]
    UnauthorizedWithdrawal,
    #[msg("Insufficient funds for withdrawal")]
    InsufficientFunds,
}
