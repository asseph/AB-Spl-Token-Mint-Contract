import { Program, web3 } from '@project-serum/anchor';
import * as anchor from '@project-serum/anchor';
import { Keypair, 
    PublicKey,
    SystemProgram,
    SYSVAR_RENT_PUBKEY,
    Transaction,
    TransactionInstruction,
    sendAndConfirmTransaction } from '@solana/web3.js';
import { Token, TOKEN_PROGRAM_ID, AccountLayout, MintLayout, ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";

import fs from 'fs';
import { GlobalInfo } from './types';

const GLOBAL_INFO_SIZE = 1656;     // 8 + 1648
const GLOBAL_AUTHORITY_SEED = "global-authority";

const ADMIN_PUBKEY = new PublicKey("Fs8R7R6dP3B7mAJ6QmWZbomBRuTbiJyiR4QYjoxhLdPu");
const VESTING_TOKEN_MINT = new PublicKey("CFt8zQNRUpK4Lxhgv64JgZ5giZ3VWXSceQr6yKh7VoFU");
const PROGRAM_ID = "Ah9YbbS3KuYYoa26CuNMjzN6U4aBcu1ZgimSKeD7Q9zs";

export let solConnection = null;
export let payer = null;
let program: Program = null;

export const setClusterConfig = (cluster: web3.Cluster) => {
  anchor.setProvider(anchor.Provider.local(web3.clusterApiUrl(cluster)));
  solConnection = anchor.getProvider().connection;
  payer = anchor.getProvider().wallet;
  // Configure the client to use the local cluster.
  // const walletKeypair = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(path.resolve("/home/fury/.config/solana/id.json"), 'utf-8'))), { skipValidation: true });
  const idl = JSON.parse(
      fs.readFileSync(__dirname + "/aiko_vesting.json", "utf8")
  );
  // Address of the deployed program.
  const programId = new anchor.web3.PublicKey(PROGRAM_ID);
  // Generate the program client from IDL.
  program = new anchor.Program(idl, programId);
  console.log('ProgramId: ', program.programId.toBase58());
}

const main = async () => {
    setClusterConfig('devnet');

    const [globalAuthority, bump] = await PublicKey.findProgramAddress(
        [Buffer.from(GLOBAL_AUTHORITY_SEED)],
        program.programId
    );
    console.log('GlobalAuthority: ', globalAuthority.toBase58());

    // await initProject();
    // await updateGlobalInfo(null, true);
    // await addToWhitelist(payer.publicKey, new PublicKey('51QHr8aS4En232fPCWUYLxWYw4crwxeap56n4jF1283Y'));
    // await addToWhitelist(payer.publicKey, payer.publicKey);
    // await removeFromWhitelist(payer.publicKey, new PublicKey('51QHr8aS4En232fPCWUYLxWYw4crwxeap56n4jF1283Y'));

    let globalInfo: GlobalInfo = await getGlobalState();
    let result = {
      admin: globalInfo.admin.toBase58(),
      whitelistedCount: globalInfo.whitelistedCount.toNumber(),
      whitelist: globalInfo.whitelist.slice(0, globalInfo.whitelistedCount.toNumber()).map((info) => info.toBase58()),
      active: globalInfo.active.toNumber(),
    };
    console.log("globalInfo =", result);

    // await transferFreezeAuthority(payer.publicKey, new PublicKey('51QHr8aS4En232fPCWUYLxWYw4crwxeap56n4jF1283Y'));
    // const tokenInfo = await solConnection.getParsedAccountInfo(VESTING_TOKEN_MINT);
    // console.log(tokenInfo.value.data);

    // await freeAccount(new PublicKey('GCWw2KnpfxE6PP4Yja2BXgc8w3s8PYyw26WYSAGZ7qb6'));
    // await thawAccount(payer.publicKey, new PublicKey('GCWw2KnpfxE6PP4Yja2BXgc8w3s8PYyw26WYSAGZ7qb6'));

    // await transferWithUnlock(
    //     payer.publicKey,
    //     new PublicKey('5oKXqF5gGzr7VBRZimjesH7amq1ZddMhjCD7VyZTghuX'),
    //     new PublicKey('GCWw2KnpfxE6PP4Yja2BXgc8w3s8PYyw26WYSAGZ7qb6'),
    //     1_000_000,
    // );
};

export const initProject = async () => {
    const [globalAuthority, bump] = await PublicKey.findProgramAddress(
        [Buffer.from(GLOBAL_AUTHORITY_SEED)],
        program.programId
    );
    const tx = await program.rpc.initialize(
      bump, {
        accounts: {
          admin: payer.publicKey,
          globalAuthority,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        },
        signers: [],
    });
    await solConnection.confirmTransaction(tx, "confirmed");
  
    console.log("txHash =", tx);
}

export const updateGlobalInfo = async (
    newAdmin: PublicKey | null,
    active: boolean,
) => {
    const [globalAuthority, bump] = await PublicKey.findProgramAddress(
      [Buffer.from(GLOBAL_AUTHORITY_SEED)],
      program.programId
    );
    let tx = await program.rpc.updateGlobalState(
      bump, newAdmin, new anchor.BN(active == true ? 1 : 0), {
        accounts: {
          admin: payer.publicKey,
          globalAuthority,
        },
        signers: [],
      });
    console.log("Your transaction signature", tx);
}

export const transferFreezeAuthority = async (
    walletAddress: PublicKey,
    newAdmin: PublicKey,
) => {
    const [globalAuthority, bump] = await PublicKey.findProgramAddress(
      [Buffer.from(GLOBAL_AUTHORITY_SEED)],
      program.programId
    );
    let tx = await program.rpc.transferFreezeAuthority(
      bump, {
        accounts: {
          admin: walletAddress,
          globalAuthority,
          vestingToken: VESTING_TOKEN_MINT,
          newAuthority: newAdmin,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
        signers: [],
      });
    console.log("Your transaction signature", tx);
}

export const addToWhitelist = async (
    walletAddress: PublicKey,
    address: PublicKey,
) => {
    const [globalAuthority, bump] = await PublicKey.findProgramAddress(
        [Buffer.from(GLOBAL_AUTHORITY_SEED)],
        program.programId
      );
  
      let tx = await program.rpc.addToWhitelist(
        bump, address, {
          accounts: {
            admin: walletAddress,
            globalAuthority,
          },
          signers: [],
        });
      console.log("Your transaction signature", tx);
}

export const removeFromWhitelist = async (
    walletAddress: PublicKey,
    address: PublicKey,
) => {
    const [globalAuthority, bump] = await PublicKey.findProgramAddress(
        [Buffer.from(GLOBAL_AUTHORITY_SEED)],
        program.programId
      );
  
      let tx = await program.rpc.removeFromWhitelist(
        bump, address, {
          accounts: {
            admin: walletAddress,
            globalAuthority,
          },
          signers: [],
        });
      console.log("Your transaction signature", tx);
}

export const freeAccount = async (
    userTokenAccount: PublicKey,
) => {
    const [globalAuthority, bump] = await PublicKey.findProgramAddress(
        [Buffer.from(GLOBAL_AUTHORITY_SEED)],
        program.programId
    );
  
    let tx = await program.rpc.freezeTokenAccount(
        bump, {
          accounts: {
            globalAuthority,
            userTokenAccount: userTokenAccount,
            vestingToken: VESTING_TOKEN_MINT,
            tokenProgram: TOKEN_PROGRAM_ID,
          },
          signers: [],
    });
    console.log("Your transaction signature", tx);

    let accountInfo = await solConnection.getParsedAccountInfo(userTokenAccount);
    console.log(accountInfo.value.data);
}

export const thawAccount = async (
    walletAddress: PublicKey,
    userTokenAccount: PublicKey,
) => {
    const [globalAuthority, bump] = await PublicKey.findProgramAddress(
        [Buffer.from(GLOBAL_AUTHORITY_SEED)],
        program.programId
    );
  
    let tx = await program.rpc.thawTokenAccount(
        bump, {
          accounts: {
            applicant: walletAddress,
            globalAuthority,
            userTokenAccount: userTokenAccount,
            vestingToken: VESTING_TOKEN_MINT,
            tokenProgram: TOKEN_PROGRAM_ID,
          },
          signers: [],
    });
    console.log("Your transaction signature", tx);

    let accountInfo = await solConnection.getParsedAccountInfo(userTokenAccount);
    console.log(accountInfo.value.data);
}

export const transferWithUnlock = async (
    walletAddress: PublicKey,
    sender: PublicKey,
    recipient: PublicKey,
    amount: number,
) => {
    let instructions = [];
    let ret = await getATokenAccountsNeedCreate(
        solConnection,
        walletAddress,
        sender,
        [VESTING_TOKEN_MINT],
    )
    let userTokenAccount = ret.destinationAccounts[0];
    instructions.push(...ret.instructions);
    
    ret = await getATokenAccountsNeedCreate(
        solConnection,
        walletAddress,
        recipient,
        [VESTING_TOKEN_MINT],
    )
    let destTokenAccount = ret.destinationAccounts[0];
    instructions.push(...ret.instructions);

    const [globalAuthority, bump] = await PublicKey.findProgramAddress(
        [Buffer.from(GLOBAL_AUTHORITY_SEED)],
        program.programId
    );

    const tx = await program.rpc.transferWithUnlock(
      bump, new anchor.BN(amount), {
        accounts: {
          applicant: walletAddress,
          globalAuthority,
          userTokenAccount,
          vestingToken: VESTING_TOKEN_MINT,
          destTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
        instructions,
        signers: []
      }
    )
    console.log("Your transaction signature", tx);

    let accountInfo = await solConnection.getParsedAccountInfo(userTokenAccount);
    console.dir(accountInfo.value.data, {depth: null});
    accountInfo = await solConnection.getParsedAccountInfo(destTokenAccount);
    console.dir(accountInfo.value.data, {depth: null});
}

export const getGlobalState = async (
) : Promise<GlobalInfo | null> => {
    const [globalAuthority, bump] = await PublicKey.findProgramAddress(
        [Buffer.from(GLOBAL_AUTHORITY_SEED)],
        program.programId
    );
    try {
        let globalInfo = await program.account.globalInfo.fetch(globalAuthority);
        return globalInfo as GlobalInfo;
    } catch {
        return null;
    }
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

export const getATokenAccountsNeedCreate = async (
    connection: anchor.web3.Connection,
    walletAddress: anchor.web3.PublicKey,
    owner: anchor.web3.PublicKey,
    nfts: anchor.web3.PublicKey[],
) => {
    let instructions = [], destinationAccounts = [];
    for (const mint of nfts) {
        const destinationPubkey = await getAssociatedTokenAccount(owner, mint);
        let response = await connection.getAccountInfo(destinationPubkey);
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
        if (walletAddress != owner) {
            const userAccount = await getAssociatedTokenAccount(walletAddress, mint);
            response = await connection.getAccountInfo(userAccount);
            if (!response) {
                const createATAIx = createAssociatedTokenAccountInstruction(
                    userAccount,
                    walletAddress,
                    walletAddress,
                    mint,
                    );
                instructions.push(createATAIx);
            }
        }
    }
    return {
        instructions,
        destinationAccounts,
    };
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
  
// main();