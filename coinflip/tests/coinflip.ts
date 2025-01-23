import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Coinflip } from "../target/types/coinflip";
import { PublicKey, LAMPORTS_PER_SOL, SystemProgram } from "@solana/web3.js";
import { expect } from "chai";

describe("coinflip", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Coinflip as Program<Coinflip>;

  // House settings
  const HOUSE_FEE = 5; // 5% house fee

  // PDAs
  let housePDA: PublicKey;
  let houseBump: number;

  // Find PDAs before tests
  before(async () => {
    [housePDA, houseBump] = await PublicKey.findProgramAddress(
      [Buffer.from("house")],
      program.programId
    );
  });

  it("Initializes the house", async () => {
    const tx = await program.methods
      .initialize(HOUSE_FEE)
      .accounts({
        house: housePDA,
        authority: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const houseAccount = await program.account.house.fetch(housePDA);
    expect(houseAccount.authority).to.eql(provider.wallet.publicKey);
    expect(houseAccount.fee).to.equal(HOUSE_FEE);
  });

  it("Fails to initialize with invalid fee", async () => {
    try {
      await program.methods
        .initialize(101)
        .accounts({
          house: housePDA,
          authority: provider.wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      expect.fail("Should have failed with invalid fee");
    } catch (e) {
      expect(e.message).to.include("House fee must be between 0 and 100");
    }
  });

  it("Places a bet", async () => {
    const player = anchor.web3.Keypair.generate();

    // Airdrop SOL to player
    const signature = await provider.connection.requestAirdrop(
      player.publicKey,
      2 * LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(signature);

    const [gamePDA] = await PublicKey.findProgramAddress(
      [Buffer.from("game"), player.publicKey.toBuffer()],
      program.programId
    );

    const betAmount = LAMPORTS_PER_SOL;

    await program.methods
      .placeBet(new anchor.BN(betAmount))
      .accounts({
        game: gamePDA,
        player: player.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([player])
      .rpc();

    const gameAccount = await program.account.game.fetch(gamePDA);
    expect(gameAccount.player).to.eql(player.publicKey);
    expect(gameAccount.betAmount.toNumber()).to.equal(betAmount);
    expect(gameAccount.settled).to.be.false;
  });

  it("Flips coin and settles bet", async () => {
    const player = anchor.web3.Keypair.generate();

    // Airdrop SOL to player
    const signature = await provider.connection.requestAirdrop(
      player.publicKey,
      2 * LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(signature);

    const [gamePDA] = await PublicKey.findProgramAddress(
      [Buffer.from("game"), player.publicKey.toBuffer()],
      program.programId
    );

    const betAmount = LAMPORTS_PER_SOL;

    // Place bet
    await program.methods
      .placeBet(new anchor.BN(betAmount))
      .accounts({
        game: gamePDA,
        player: player.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([player])
      .rpc();

    // Flip coin
    await program.methods
      .flipCoin()
      .accounts({
        game: gamePDA,
        house: housePDA,
        player: player.publicKey,
      })
      .rpc();

    const gameAccount = await program.account.game.fetch(gamePDA);
    expect(gameAccount.settled).to.be.true;
  });

  it("Allows house to withdraw funds", async () => {
    const withdrawAmount = LAMPORTS_PER_SOL / 2;

    const houseBalanceBefore = await provider.connection.getBalance(housePDA);

    await program.methods
      .withdraw(new anchor.BN(withdrawAmount))
      .accounts({
        house: housePDA,
        authority: provider.wallet.publicKey,
      })
      .rpc();

    const houseBalanceAfter = await provider.connection.getBalance(housePDA);
    expect(houseBalanceAfter).to.equal(houseBalanceBefore - withdrawAmount);
  });

  it("Prevents unauthorized withdrawal", async () => {
    const unauthorized = anchor.web3.Keypair.generate();
    const withdrawAmount = LAMPORTS_PER_SOL / 2;

    try {
      await program.methods
        .withdraw(new anchor.BN(withdrawAmount))
        .accounts({
          house: housePDA,
          authority: unauthorized.publicKey,
        })
        .signers([unauthorized])
        .rpc();
      expect.fail("Should have failed with unauthorized withdrawal");
    } catch (e) {
      expect(e.message).to.include("Unauthorized withdrawal attempt");
    }
  });
});
