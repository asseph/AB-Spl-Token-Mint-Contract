#!/usr/bin/env ts-node
import * as dotenv from "dotenv";
import * as fs from 'fs';
import { program } from 'commander';
import { 
    PublicKey,
} from '@solana/web3.js';
import { initProject, getGlobalState, updateGlobalInfo, addToWhitelist, setClusterConfig, payer, removeFromWhitelist, transferFreezeAuthority, freeAccount, thawAccount, transferWithUnlock } from "./helper";
import { GlobalInfo } from "./types";

dotenv.config({ path: __dirname+'/../.env' });

program.version('0.0.1');

programCommand('status')
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  .action(async (directory, cmd) => {
    const {
      env,
    } = cmd.opts();
    console.log('Solana config: ', env);
    setClusterConfig(env);

    let globalInfo: GlobalInfo = await getGlobalState();
    let result = {
      admin: globalInfo.admin.toBase58(),
      whitelistedCount: globalInfo.whitelistedCount.toNumber(),
      whitelist: globalInfo.whitelist.slice(0, globalInfo.whitelistedCount.toNumber()).map((info) => info.toBase58()),
      active: globalInfo.active.toNumber(),
    };
    console.log("globalInfo =", result);
});

programCommand('init')
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  .action(async (directory, cmd) => {
    const {
      env,
    } = cmd.opts();
    console.log('Solana config: ', env);
    setClusterConfig(env);

    await initProject();
});

programCommand('update_status')
  .option('-a, --admin <string>', 'vesting contract admin')
  .option('-s --active <boolean>', 'vesting contract active')
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  .action(async (directory, cmd) => {
    const {
      env,
      admin,
      active,
    } = cmd.opts();

    console.log('Solana config: ', env);
    setClusterConfig(env);

    if (admin === undefined && active === undefined) {
      console.log("Error input");
      return;
    }
    let status: string = active;
    if (active !== undefined && status != 'true' && status != 'false') {
      console.log("Error input");
      return;
    }
    await updateGlobalInfo(admin === undefined ? null : new PublicKey(admin), active === undefined ? null : status == "true");
});

programCommand('add_whitelist')
  .option('-a, --address <string>', 'wallet or account address to add whitelist')
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  .action(async (directory, cmd) => {
    const {
      env,
      address,
    } = cmd.opts();

    console.log('Solana config: ', env);
    setClusterConfig(env);

    if (address === undefined) {
      console.log("Error input");
      return;
    }
    console.log("Add to whitelist: ", address);
    await addToWhitelist(new PublicKey(payer.publicKey), new PublicKey(address));
});

programCommand('remove_whitelist')
  .option('-a, --address <string>', 'wallet or account address to remove from whitelist')
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  .action(async (directory, cmd) => {
    const {
      env,
      address,
    } = cmd.opts();

    console.log('Solana config: ', env);
    setClusterConfig(env);

    if (address === undefined) {
      console.log("Error input");
      return;
    }
    console.log("remove from whitelist: ", address);
    await removeFromWhitelist(new PublicKey(payer.publicKey), new PublicKey(address));
});

programCommand('transfer_authority')
  .option('-a, --address <string>', 'wallet address to be a new freeze authority')
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  .action(async (directory, cmd) => {
    const {
      env,
      address,
    } = cmd.opts();

    console.log('Solana config: ', env);
    setClusterConfig(env);

    if (address === undefined) {
      console.log("Error input");
      return;
    }
    console.log("New freeze authority: ", address);
    await transferFreezeAuthority(new PublicKey(payer.publicKey), new PublicKey(address));
});

programCommand('freeze')
  .option('-a, --account <string>', 'account to freeze')
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  .action(async (directory, cmd) => {
    const {
      env,
      account,
    } = cmd.opts();

    console.log('Solana config: ', env);
    setClusterConfig(env);

    if (account === undefined) {
      console.log("Error input");
      return;
    }
    console.log("Freeze account: ", account);
    await freeAccount(new PublicKey(account));
});

programCommand('thaw')
  .option('-a, --account <string>', 'account to thaw')
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  .action(async (directory, cmd) => {
    const {
      env,
      account,
    } = cmd.opts();

    console.log('Solana config: ', env);
    setClusterConfig(env);

    if (account === undefined) {
      console.log("Error input");
      return;
    }
    console.log("Thaw account: ", account);
    await thawAccount(payer.publicKey, new PublicKey(account));
});

programCommand('transfer')
  .option('-s, --source <string>', 'source token account')
  .option('-d, --destination <string>', 'destination token account')
  .option('-a, --amount <number>', 'transfer amount')
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  .action(async (directory, cmd) => {
    const {
      env,
      source,
      destination,
      amount,
    } = cmd.opts();

    console.log('Solana config: ', env);
    setClusterConfig(env);

    if (source === undefined || destination === undefined || amount === undefined) {
      console.log('Error input');
      return;
    }
    const value = parseInt(amount);
    if (amount <= 0 || isNaN(value)) {
      console.log('Error input');
      return;
    }
    console.log('Transfer from', source, 'to', destination, value);
    await transferWithUnlock(payer.publicKey, new PublicKey(source), new PublicKey(destination), value);
});

function programCommand(name: string) {
  return program
    .command(name)
    .option(
      '-e, --env <string>',
      'Solana cluster env name',
      'devnet', //mainnet-beta, testnet, devnet
    )
}

program.parse(process.argv);
