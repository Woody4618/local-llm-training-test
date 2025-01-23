use anchor_lang::prelude::*;

declare_id!("8M3EUG6YEegrzCWkJz4cbRT8mGf5RhK7ZZAe1cMexTdV");

#[program]
pub mod coinflip_with_anchor_train {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let game = &mut ctx.accounts.game;
        game.authority = ctx.accounts.authority.key();
        game.bet_amount = 0;
        game.total_flips = 0;
        game.total_wins = 0;
        Ok(())
    }

    pub fn place_bet(ctx: Context<PlaceBet>, bet_amount: u64, guess: bool) -> Result<()> {
        require!(bet_amount > 0, CustomError::InvalidBetAmount);

        let game = &mut ctx.accounts.game;
        let player = &ctx.accounts.player;

        // Transfer SOL from player to game account
        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: player.to_account_info(),
                to: game.to_account_info(),
            },
        );

        anchor_lang::system_program::transfer(cpi_context, bet_amount)?;

        // Get a "random" value using the slot
        let slot = Clock::get()?.slot;
        let result = slot % 2 == 0;

        game.total_flips += 1;

        // Check if player won
        if result == guess {
            game.total_wins += 1;

            // Check if game account has enough balance to pay out
            let game_balance = game.to_account_info().lamports();
            let payout_amount = bet_amount * 2;
            require!(
                game_balance >= payout_amount,
                CustomError::InsufficientGameBalance
            );

            // Transfer double the bet amount back to player
            **game.to_account_info().try_borrow_mut_lamports()? -= payout_amount;
            **player.to_account_info().try_borrow_mut_lamports()? += payout_amount;
            msg!("Congratulations! You won!");
        } else {
            msg!("Sorry, you lost!");
        }

        Ok(())
    }

    pub fn close_game(ctx: Context<CloseGame>) -> Result<()> {
        let game = &ctx.accounts.game;
        let authority = &ctx.accounts.authority;

        // Transfer remaining lamports to authority
        let balance = game.to_account_info().lamports();
        **game.to_account_info().try_borrow_mut_lamports()? -= balance;
        **authority.to_account_info().try_borrow_mut_lamports()? += balance;

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 8 + 8 + 8,
        seeds = [b"game", authority.key().as_ref()],
        bump
    )]
    pub game: Account<'info, Game>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct PlaceBet<'info> {
    #[account(
        mut,
        seeds = [b"game", game.authority.as_ref()],
        bump,
    )]
    pub game: Account<'info, Game>,
    #[account(mut)]
    pub player: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CloseGame<'info> {
    #[account(
        mut,
        close = authority,
        has_one = authority,
        seeds = [b"game", authority.key().as_ref()],
        bump
    )]
    pub game: Account<'info, Game>,
    #[account(mut)]
    pub authority: Signer<'info>,
}

#[account]
pub struct Game {
    pub authority: Pubkey,
    pub bet_amount: u64,
    pub total_flips: u64,
    pub total_wins: u64,
}

#[error_code]
pub enum CustomError {
    #[msg("Bet amount must be greater than 0")]
    InvalidBetAmount,
    #[msg("Game account has insufficient balance for payout")]
    InsufficientGameBalance,
}
