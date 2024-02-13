# ART_Token_Vesting
$ART SPL token vesting program by using freeze authority of token

This program is designed to keep the token accounts in a frozen state so that the holders can't use the SPL tokens for their purpose until a certain period.

The only allowed usage is paying the SPL token for minting a new Aiko Collection NFTs with SPL token paying.

## Getting Set Up

### Prerequisites

* Ensure you have recent versions of both `node` and `yarn` installed.

* Follow the instructions [here](https://docs.solana.com/cli/install-solana-cli-tools) to install the Solana Command Line Toolkit.

### Installation

Install all npm dependencies by running `yarn install`.

### Command Usage

To run the project, start commands in `cli/command.ts` with `yarn ts-node` script:

```
init 
```

Initialize the Aiko Vesting program. Don't need it after init once.

```
status
```

Get current config and whitelist of the Aiko Vesting program.

```
update_status
```

Able to update the program's config and whitelist with this command. \
`-a --admin <string>` - The admin address of the Aiko Vesting program. Admin can send private all transactions such as `update_status`. \
`-s --active <boolean>` - If the active status is false, all requests for transfer from/to frozen account will be allowed. And also don't freeze all accounts after running instructions.

```
add_whitelist
```

Add certain owner wallet or token account which allows transferring and thaw. `Admin can call this intruction.` \
`-a --address <string>` - The allowed address adds to the whitelist of the program.

```
remove_whitelist
```

Remove certain owner wallet or token account which allows transferring and thaw. `Admin can call this intruction.` \
`-a --address <string>` - The blocked address removes from the whitelist of the program.

```
transfer_authority
```

Transfer the freeze authority of $ART token which the PDA of the program got. `Admin can call this intruction.` \
`-a --address <string>` - The wallet address to transfer the freeze authority of $ART token.

```
freeze
```

Freeze a certain token account with PDA's freeze authority. `This request allowed for all callers even one isn't on the whitelist.` \
`-a --account <string>` - The $ART token account address to freeze.

```
thaw
```

Thaw a certain token account with PDA's freeze authority. `This request is limited to particular callers who are on the whitelist.` \
`-a --account <string>` - The $ART token account address to thaw.

```
transfer
```

Transfer a certain amount of $ART token from one owner to another. `This request is allowed if the source or destination token accounts or its owner are on the whitelist.` \
`-a --account <string>` - The $ART token account address to thaw.

### Cluster Config

All commands have one option to configure the Cluster of Solana Network. \
`-e --env <string>` - Cluster config value \
`mainnet-beta`, `devnet`, `testnet` - One of this value is config. Default is `devnet`.

