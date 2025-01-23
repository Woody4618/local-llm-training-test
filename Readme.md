

1. claude-3.5-sonnet 
Please create me a complete solana anchor program that does an onchain coinflip

- Didnt know how to do bumbs correctly. 
- Did rust errors with mutable references 

   Compiling coinflip v0.1.0 (/Users/jonasmac2/Documents/GitHub/local-llm-training-test/coinflip/programs/coinflip)
error[E0599]: no method named `get` found for struct `InitializeBumps` in the current scope
   --> programs/coinflip/src/lib.rs:16:33
    |
16  |         house.bump = *ctx.bumps.get("house").unwrap();
    |                       ----------^^^---------
    |                       |         |
    |                       |         this is an associated function, not a method
    |                       help: use associated function syntax instead: `InitializeBumps::get("house")`
...
116 | #[derive(Accounts)]
    |          -------- method `get` not found for this struct
    |
    = note: found the following associated functions; to be used as methods, functions must have a `self` parameter
note: the candidate is defined in the trait `anchor_lang::prelude::SolanaSysvar`
   --> src/sysvar/mod.rs:214:5
    = help: items from traits can only be used if the trait is implemented and in scope
    = note: the following traits define an item `get`, perhaps you need to implement one of them:
            candidate #1: `SliceIndex`
            candidate #2: `ZeroCopyAccessor`
            candidate #3: `anchor_lang::solana_program::account_info::Account`

error[E0599]: no method named `get` found for struct `PlaceBetBumps` in the current scope
   --> programs/coinflip/src/lib.rs:39:32
    |
39  |         game.bump = *ctx.bumps.get("game").unwrap();
    |                      ----------^^^--------
    |                      |         |
    |                      |         this is an associated function, not a method
    |                      help: use associated function syntax instead: `PlaceBetBumps::get("game")`
...
132 | #[derive(Accounts)]
    |          -------- method `get` not found for this struct
    |
    = note: found the following associated functions; to be used as methods, functions must have a `self` parameter
note: the candidate is defined in the trait `anchor_lang::prelude::SolanaSysvar`
   --> src/sysvar/mod.rs:214:5
    = help: items from traits can only be used if the trait is implemented and in scope
    = note: the following traits define an item `get`, perhaps you need to implement one of them:
            candidate #1: `SliceIndex`
            candidate #2: `ZeroCopyAccessor`
            candidate #3: `anchor_lang::solana_program::account_info::Account`

For more information about this error, try `rustc --explain E0599`.
error: could not compile `coinflip` (lib) due to 2 previous errors

2. Trained with gitingest data from https://gitingest.com/ 

- Needed two times pasting the errors back into the terminal
- Managed to get it to work with 4 tests passing. 


3. Feeding it the program examples as well 

- Needed one times pasting an error about borrow into the terminal 
- Starting emitting events. 

https://github.com/solana-developers/program-examples