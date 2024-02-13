import * as anchor from '@project-serum/anchor';
import { Program } from '@project-serum/anchor';
import { 
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
} from '@solana/web3.js';
import { ASSOCIATED_TOKEN_PROGRAM_ID, MintLayout, Token, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { AikoVesting } from '../target/types/aiko_vesting';
import fs from 'fs';

const GLOBAL_AUTHORITY_SEED = "global-authority";
const VESTING_TOKEN_MINT = new PublicKey("CFt8zQNRUpK4Lxhgv64JgZ5giZ3VWXSceQr6yKh7VoFU");

anchor.setProvider(anchor.Provider.env());
const provider = anchor.getProvider();
const program = anchor.workspace.AikoVesting as Program<AikoVesting>;
console.log('ProgramId: ', program.programId.toBase58());

describe('Aiko_Vesting', async () => {
  console.log(process.env.ANCHOR_WALLET, 'wallet path');
  let rawdata = fs.readFileSync(process.env.ANCHOR_WALLET);
  let keyData = JSON.parse(rawdata.toString());

  let superOwner = anchor.web3.Keypair.fromSecretKey(new Uint8Array(keyData));
  let user = anchor.web3.Keypair.fromSecretKey(new Uint8Array(keyData));
  
  rawdata = fs.readFileSync('tests/keys/art_token.json');
  keyData = JSON.parse(rawdata.toString());
  let vestingKeypair = anchor.web3.Keypair.fromSecretKey(new Uint8Array(keyData));

  console.log(`superOwner = ${superOwner.publicKey.toBase58()}`);
  console.log('Vesting Token: ', vestingKeypair.publicKey.toBase58());

  const vestingToken = new Token(
    provider.connection,
    VESTING_TOKEN_MINT,
    TOKEN_PROGRAM_ID,
    superOwner,
  )

  const [globalAuthority, bump] = await PublicKey.findProgramAddress(
    [Buffer.from(GLOBAL_AUTHORITY_SEED)],
    program.programId
  );
  console.log('GlobalAuthority: ', globalAuthority.toBase58());

  // const vestingAccount = await getAssociatedTokenAccount(globalAuthority, VESTING_TOKEN_MINT);
  // console.log('vestingAccount: ', vestingAccount.toBase58());

  let userTokenAccount = null;
  let ownerTokenAccount = null;

  it('Is initialized!', async () => {
    // Add your test here.
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(superOwner.publicKey, 1000000000),
      "confirmed"
    );
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(user.publicKey, 1000000000),
      "confirmed"
    );
    
    console.log("super owner =", superOwner.publicKey.toBase58());
    console.log("user =", user.publicKey.toBase58());

    const [globalAuthority, bump] = await PublicKey.findProgramAddress(
      [Buffer.from(GLOBAL_AUTHORITY_SEED)],
      program.programId
    );
    console.log("Global authority = ", globalAuthority.toBase58());

    // Allocate memory for the account
    const balanceNeeded = await Token.getMinBalanceRentForExemptMint(
      provider.connection,
    );
    const transaction = new anchor.web3.Transaction();
    transaction.add(
        anchor.web3.SystemProgram.createAccount({
            fromPubkey: superOwner.publicKey,
            newAccountPubkey: VESTING_TOKEN_MINT,
            lamports: balanceNeeded,
            space: MintLayout.span,
            programId: TOKEN_PROGRAM_ID,
        }),
    );
    transaction.add(
        Token.createInitMintInstruction(
            TOKEN_PROGRAM_ID,
            VESTING_TOKEN_MINT,
            6,
            superOwner.publicKey,
            superOwner.publicKey,
        ),
    );
    
    // transaction.add(
    //   Token.createAssociatedTokenAccountInstruction(
    //     ASSOCIATED_TOKEN_PROGRAM_ID,
    //     TOKEN_PROGRAM_ID,
    //     VESTING_TOKEN_MINT,
    //     vestingAccount,
    //     globalAuthority,
    //     superOwner.publicKey,
    //   ),
    // );

    transaction.add(
      Token.createSetAuthorityInstruction(
        TOKEN_PROGRAM_ID,
        VESTING_TOKEN_MINT,
        globalAuthority,
        'FreezeAccount',
        superOwner.publicKey,
        [],
      )
    )
    const txId = await provider.send(transaction, [vestingKeypair]);
    await provider.connection.confirmTransaction(txId);


    const tokenInfo = await provider.connection.getParsedAccountInfo(VESTING_TOKEN_MINT);
    console.log(tokenInfo.value.data);

    let tx = await program.rpc.initialize(
      bump, {
        accounts: {
          admin: superOwner.publicKey,
          globalAuthority,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        },
        signers: [superOwner],
      });
    console.log("Your transaction signature", tx);
    await getGlobalState();
  });

  it('Freeze user token account', async () => {
    userTokenAccount = await vestingToken.createAccount(user.publicKey);
    await vestingToken.mintTo(
      userTokenAccount,
      superOwner,
      [],
      10_000_000_000
    );
    
    const tx = await program.rpc.freezeTokenAccount(
      bump, {
        accounts: {
          globalAuthority,
          userTokenAccount: userTokenAccount,
          vestingToken: VESTING_TOKEN_MINT,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
      }
    )
    console.log("Your transaction signature", tx);

    let accountInfo = await provider.connection.getParsedAccountInfo(userTokenAccount);
    console.log(accountInfo.value.data);
  });

  it('Add address to whitelist', async () => {
    const [globalAuthority, bump] = await PublicKey.findProgramAddress(
      [Buffer.from(GLOBAL_AUTHORITY_SEED)],
      program.programId
    );

    let tx = await program.rpc.addToWhitelist(
      bump, superOwner.publicKey, {
        accounts: {
          admin: superOwner.publicKey,
          globalAuthority,
        },
        signers: [superOwner],
      });
    console.log("Your transaction signature", tx);
    await getGlobalState();
  });

  it('Update global info', async () => {
    const [globalAuthority, bump] = await PublicKey.findProgramAddress(
      [Buffer.from(GLOBAL_AUTHORITY_SEED)],
      program.programId
    );

    let tx = await program.rpc.updateGlobalState(
      bump, user.publicKey, new anchor.BN(0), {
        accounts: {
          admin: superOwner.publicKey,
          globalAuthority,
        },
        signers: [superOwner],
      });
    console.log("Your transaction signature", tx);
    await getGlobalState();
  });
  
  it('Transfer token from freezed Account', async () => {
    ownerTokenAccount = await vestingToken.createAccount(superOwner.publicKey);

    let accountInfo = await provider.connection.getParsedAccountInfo(ownerTokenAccount);
    console.dir(accountInfo.value.data, {depth: null});

    const tx = await program.rpc.transferWithUnlock(
      bump, new anchor.BN(1_000_000), {
        accounts: {
          applicant: user.publicKey,
          globalAuthority,
          userTokenAccount: userTokenAccount,
          vestingToken: VESTING_TOKEN_MINT,
          destTokenAccount: ownerTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
        signers: [user]
      }
    )
    console.log("Your transaction signature", tx);

    accountInfo = await provider.connection.getParsedAccountInfo(ownerTokenAccount);
    console.dir(accountInfo.value.data, {depth: null});
    accountInfo = await provider.connection.getParsedAccountInfo(userTokenAccount);
    console.dir(accountInfo.value.data, {depth: null});
  });
  
return;
  it('Thaw user token account', async () => {
    let accountInfo = await provider.connection.getParsedAccountInfo(userTokenAccount);

    const tx = await program.rpc.thawTokenAccount(
      bump, {
        accounts: {
          applicant: user.publicKey,
          globalAuthority,
          userTokenAccount: userTokenAccount,
          vestingToken: VESTING_TOKEN_MINT,
          tokenProgram: TOKEN_PROGRAM_ID,
        }
      }
    )
    console.log("Your transaction signature", tx);

    accountInfo = await provider.connection.getParsedAccountInfo(userTokenAccount);
    console.log(accountInfo.value.data);
  });

  it('Transfer freeze authority', async () => {
    const [globalAuthority, bump] = await PublicKey.findProgramAddress(
      [Buffer.from(GLOBAL_AUTHORITY_SEED)],
      program.programId
    );
    let tx = await program.rpc.transferFreezeAuthority(
      bump, {
        accounts: {
          admin: superOwner.publicKey,
          globalAuthority,
          vestingToken: VESTING_TOKEN_MINT,
          newAuthority: superOwner.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
        signers: [superOwner],
      });
    console.log("Your transaction signature", tx);

    const tokenInfo = await provider.connection.getParsedAccountInfo(VESTING_TOKEN_MINT);
    console.log(tokenInfo.value.data);
  });

  it('Remove address from whitelist', async () => {
    const [globalAuthority, bump] = await PublicKey.findProgramAddress(
      [Buffer.from(GLOBAL_AUTHORITY_SEED)],
      program.programId
    );

    let tx = await program.rpc.removeFromWhitelist(
      bump, user.publicKey, {
        accounts: {
          admin: superOwner.publicKey,
          globalAuthority,
        },
        signers: [superOwner],
      });
    console.log("Your transaction signature", tx);
    await getGlobalState();
  });
});

export const getGlobalState = async () => {
  const [globalAuthority, bump] = await PublicKey.findProgramAddress(
    [Buffer.from(GLOBAL_AUTHORITY_SEED)],
    program.programId
  );

  let globalInfo = await program.account.globalInfo.fetch(globalAuthority);
  const result = {
    admin: globalInfo.admin.toBase58(),
    whitelistedCount: globalInfo.whitelistedCount.toNumber(),
    whitelist: globalInfo.whitelist.slice(0, globalInfo.whitelistedCount.toNumber()).map((info) => info.toBase58()),
    active: globalInfo.active.toNumber(),
  };
  console.log("globalInfo =", result);
  return result;
}

export const getATokenAccountsNeedCreate = async (
  connection: anchor.web3.Connection,
  walletAddress: anchor.web3.PublicKey,
  owner: anchor.web3.PublicKey,
  nfts: anchor.web3.PublicKey[],
) => {
  let instructions = [], destinationAccounts = [];
  for (const mint of nfts) {
    const destinationPubkey = await getAssociatedTokenAccount(owner, mint);
    const response = await connection.getAccountInfo(destinationPubkey);
    if (!response) {
      const createATAIx = createAssociatedTokenAccountInstruction(
        destinationPubkey,
        walletAddress,
        owner,
        mint,
        );
      instructions.push(createATAIx);
    }
    destinationAccounts.push(destinationPubkey);
  }
  return {
    instructions,
    destinationAccounts,
  };
}

const getAssociatedTokenAccount = async (ownerPubkey : PublicKey, mintPk : PublicKey) : Promise<PublicKey> => {
  let associatedTokenAccountPubkey = (await PublicKey.findProgramAddress(
    [
        ownerPubkey.toBuffer(),
        TOKEN_PROGRAM_ID.toBuffer(),
        mintPk.toBuffer(), // mint address
    ],
    ASSOCIATED_TOKEN_PROGRAM_ID
  ))[0];
  return associatedTokenAccountPubkey;
}

export const createAssociatedTokenAccountInstruction = (
  associatedTokenAddress: anchor.web3.PublicKey,
  payer: anchor.web3.PublicKey,
  walletAddress: anchor.web3.PublicKey,
  splTokenMintAddress: anchor.web3.PublicKey
) => {
  const keys = [
    { pubkey: payer, isSigner: true, isWritable: true },
    { pubkey: associatedTokenAddress, isSigner: false, isWritable: true },
    { pubkey: walletAddress, isSigner: false, isWritable: false },
    { pubkey: splTokenMintAddress, isSigner: false, isWritable: false },
    {
      pubkey: anchor.web3.SystemProgram.programId,
      isSigner: false,
      isWritable: false,
    },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    {
      pubkey: anchor.web3.SYSVAR_RENT_PUBKEY,
      isSigner: false,
      isWritable: false,
    },
  ];
  return new anchor.web3.TransactionInstruction({
    keys,
    programId: ASSOCIATED_TOKEN_PROGRAM_ID,
    data: Buffer.from([]),
  });
}
