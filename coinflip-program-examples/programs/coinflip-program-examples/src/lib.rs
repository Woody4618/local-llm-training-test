use anchor_lang::prelude::*;

declare_id!("BSsWAeBxZ71pt1FsVg34RGXQnGCEcsEyLtJrPbbgpBkM");

#[program]
pub mod coinflip_program_examples {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let game_state = &mut ctx.accounts.game_state;
        game_state.authority = ctx.accounts.authority.key();
        game_state.total_flips = 0;
        game_state.total_wins = 0;
        game_state.total_losses = 0;
        Ok(())
    }

    pub fn flip_coin(ctx: Context<FlipCoin>, user_guess: bool) -> Result<()> {
        let game_state = &mut ctx.accounts.game_state;

        // Get the current timestamp
        let clock = Clock::get()?;
        let timestamp = clock.unix_timestamp as u32;

        // Generate pseudo-random bool using timestamp and recent blockhash
        let recent_blockhashes_info = ctx.accounts.recent_blockhashes.to_account_info();
        let recent_blockhash = recent_blockhashes_info.data.borrow();
        let random_bool = ((timestamp ^ recent_blockhash[0] as u32) % 2) == 0;

        // Update game state
        game_state.total_flips += 1;

        if user_guess == random_bool {
            game_state.total_wins += 1;
            msg!("Congratulations! You won!");
        } else {
            game_state.total_losses += 1;
            msg!("Sorry, you lost!");
        }

        emit!(FlipResult {
            player: ctx.accounts.authority.key(),
            user_guess,
            result: random_bool,
            won: user_guess == random_bool
        });

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 8 + 8 + 8 // discriminator + pubkey + 3 counters
    )]
    pub game_state: Account<'info, GameState>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct FlipCoin<'info> {
    #[account(mut)]
    pub game_state: Account<'info, GameState>,
    pub authority: Signer<'info>,
    /// CHECK: Recent blockhashes is a system account that doesn't need initialization
    pub recent_blockhashes: AccountInfo<'info>,
}

#[account]
pub struct GameState {
    pub authority: Pubkey,
    pub total_flips: u64,
    pub total_wins: u64,
    pub total_losses: u64,
}

#[event]
pub struct FlipResult {
    pub player: Pubkey,
    pub user_guess: bool,
    pub result: bool,
    pub won: bool,
}
