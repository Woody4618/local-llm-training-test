import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { CoinflipWithAnchorTrain } from "../target/types/coinflip_with_anchor_train";
import { PublicKey } from "@solana/web3.js";
import { expect } from "chai";

describe("coinflip-with-anchor-train", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace
    .CoinflipWithAnchorTrain as Program<CoinflipWithAnchorTrain>;

  let gamePda: PublicKey;
  let gameBump: number;

  // Add initial funds to ensure game can pay out wins
  const INITIAL_GAME_BALANCE = new anchor.BN(5 * anchor.web3.LAMPORTS_PER_SOL); // 5 SOL

  before(async () => {
    // Generate PDA for game account
    [gamePda, gameBump] = await PublicKey.findProgramAddress(
      [Buffer.from("game"), provider.wallet.publicKey.toBuffer()],
      program.programId
    );
  });

  it("Initializes the game", async () => {
    try {
      const tx = await program.methods
        .initialize()
        .accounts({
          game: gamePda,
          authority: provider.wallet.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      // Fund the game account
      const transferTx = await provider.sendAndConfirm(
        new anchor.web3.Transaction().add(
          anchor.web3.SystemProgram.transfer({
            fromPubkey: provider.wallet.publicKey,
            toPubkey: gamePda,
            lamports: INITIAL_GAME_BALANCE.toNumber(),
          })
        )
      );

      const gameAccount = await program.account.game.fetch(gamePda);
      expect(gameAccount.authority.toString()).to.equal(
        provider.wallet.publicKey.toString()
      );
      expect(gameAccount.betAmount.toNumber()).to.equal(0);
      expect(gameAccount.totalFlips.toNumber()).to.equal(0);
      expect(gameAccount.totalWins.toNumber()).to.equal(0);

      // Verify game account has funds (including rent)
      const gameBalance = await provider.connection.getBalance(gamePda);
      expect(gameBalance).to.be.greaterThan(INITIAL_GAME_BALANCE.toNumber()); // Account for rent
      expect(gameBalance).to.be.lessThan(
        INITIAL_GAME_BALANCE.toNumber() + 1000000000
      ); // Reasonable upper bound
    } catch (error) {
      console.error("Error:", error);
      throw error;
    }
  });

  it("Places a bet and plays the game", async () => {
    const betAmount = new anchor.BN(0.1 * anchor.web3.LAMPORTS_PER_SOL);
    const playerInitialBalance = await provider.connection.getBalance(
      provider.wallet.publicKey
    );

    try {
      const tx = await program.methods
        .placeBet(betAmount, true)
        .accounts({
          game: gamePda,
          player: provider.wallet.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      const gameAccount = await program.account.game.fetch(gamePda);
      expect(gameAccount.totalFlips.toNumber()).to.equal(1);

      const playerFinalBalance = await provider.connection.getBalance(
        provider.wallet.publicKey
      );
      // Balance will be different based on if player won or lost
      expect(playerInitialBalance).to.not.equal(playerFinalBalance);

      // Verify game account still has enough balance for future bets
      const gameBalance = await provider.connection.getBalance(gamePda);
      expect(gameBalance).to.be.greaterThan(0);
    } catch (error) {
      console.error("Error:", error);
      throw error;
    }
  });

  it("Fails when bet amount is 0", async () => {
    try {
      await program.methods
        .placeBet(new anchor.BN(0), true)
        .accounts({
          game: gamePda,
          player: provider.wallet.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();
      expect.fail("Expected transaction to fail");
    } catch (error) {
      expect(error.error?.errorMessage).to.include(
        "Bet amount must be greater than 0"
      );
    }
  });

  it("Closes the game and returns funds", async () => {
    const authorityInitialBalance = await provider.connection.getBalance(
      provider.wallet.publicKey
    );

    try {
      const tx = await program.methods
        .closeGame()
        .accounts({
          game: gamePda,
          authority: provider.wallet.publicKey,
        })
        .rpc();

      const authorityFinalBalance = await provider.connection.getBalance(
        provider.wallet.publicKey
      );
      expect(authorityFinalBalance).to.be.greaterThan(authorityInitialBalance);

      // Verify account is closed
      const gameAccount = await provider.connection.getAccountInfo(gamePda);
      expect(gameAccount).to.be.null;
    } catch (error) {
      console.error("Error:", error);
      throw error;
    }
  });
});
