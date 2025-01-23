import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { CoinflipProgramExamples } from "../target/types/coinflip_program_examples";
import { PublicKey } from "@solana/web3.js";
import { expect } from "chai";

describe("coinflip-program-examples", () => {
  // Configure the client to use the local cluster
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace
    .CoinflipProgramExamples as Program<CoinflipProgramExamples>;

  // Generate a keypair for our game state account
  const gameStateKeypair = anchor.web3.Keypair.generate();

  it("Initializes the game state", async () => {
    const tx = await program.methods
      .initialize()
      .accounts({
        gameState: gameStateKeypair.publicKey,
        authority: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([gameStateKeypair])
      .rpc();

    console.log("Initialize transaction signature", tx);

    // Fetch the created account
    const gameState = await program.account.gameState.fetch(
      gameStateKeypair.publicKey
    );

    // Verify the initialized values
    expect(gameState.authority.toString()).to.equal(
      provider.wallet.publicKey.toString()
    );
    expect(gameState.totalFlips.toNumber()).to.equal(0);
    expect(gameState.totalWins.toNumber()).to.equal(0);
    expect(gameState.totalLosses.toNumber()).to.equal(0);
  });

  it("Can flip a coin", async () => {
    const tx = await program.methods
      .flipCoin(true) // We guess true
      .accounts({
        gameState: gameStateKeypair.publicKey,
        authority: provider.wallet.publicKey,
        recentBlockhashes: anchor.web3.SYSVAR_RECENT_BLOCKHASHES_PUBKEY,
      })
      .rpc();

    console.log("Flip coin transaction signature", tx);

    // Fetch the updated game state
    const gameState = await program.account.gameState.fetch(
      gameStateKeypair.publicKey
    );

    // Verify that counters were updated
    expect(gameState.totalFlips.toNumber()).to.equal(1);
    expect(
      gameState.totalWins.toNumber() + gameState.totalLosses.toNumber()
    ).to.equal(1);
  });

  it("Can flip multiple times", async () => {
    // Flip 5 more times
    for (let i = 0; i < 5; i++) {
      await program.methods
        .flipCoin(i % 2 === 0) // Alternate between true and false guesses
        .accounts({
          gameState: gameStateKeypair.publicKey,
          authority: provider.wallet.publicKey,
          recentBlockhashes: anchor.web3.SYSVAR_RECENT_BLOCKHASHES_PUBKEY,
        })
        .rpc();
    }

    // Fetch the final state
    const gameState = await program.account.gameState.fetch(
      gameStateKeypair.publicKey
    );

    // Verify the total number of flips
    expect(gameState.totalFlips.toNumber()).to.equal(6); // 1 from previous test + 5 new flips
    expect(
      gameState.totalWins.toNumber() + gameState.totalLosses.toNumber()
    ).to.equal(6);
  });

  it("Emits flip result events", async () => {
    // Listen for the FlipResult event
    const listener = program.addEventListener("FlipResult", (event, slot) => {
      console.log("Flip Result:", event);
      expect(event.player.toString()).to.equal(
        provider.wallet.publicKey.toString()
      );
      // event will contain: player, userGuess, result, won
    });

    // Perform a flip
    await program.methods
      .flipCoin(true)
      .accounts({
        gameState: gameStateKeypair.publicKey,
        authority: provider.wallet.publicKey,
        recentBlockhashes: anchor.web3.SYSVAR_RECENT_BLOCKHASHES_PUBKEY,
      })
      .rpc();

    // Remove the event listener
    await program.removeEventListener(listener);
  });
});
