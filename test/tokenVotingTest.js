const assert = require('chai').assert
const {readFileRelative} = require('aeproject-utils/utils/fs-utils');
const {defaultWallets: wallets} = require('aeproject-config/config/node-config.json');

const {Universal, MemoryAccount, Node} = require('@aeternity/aepp-sdk');
const TOKEN_VOTING = readFileRelative('./contracts/TokenVoting.aes', 'utf-8');
const TOKEN = require('aeternity-fungible-token/FungibleTokenFull.aes');

const config = {
  url: 'http://localhost:3001/',
  internalUrl: 'http://localhost:3001/',
  compilerUrl: 'http://localhost:3080'
};

describe('Token Voting Contract', () => {
  let client, contract, token, sale;

  before(async () => {
    client = await Universal({
      nodes: [{
        name: 'devnetNode',
        instance: await Node(config)
      }],
      accounts: [MemoryAccount({
        keypair: wallets[0]
      })],
      networkId: 'ae_devnet',
      compilerUrl: config.compilerUrl
    });
  });


  it('Deploy Token', async () => {
    token = await client.getContractInstance(TOKEN);
    const init = await token.methods.init("Test Token", 0, "TT", undefined);
    assert.equal(init.result.returnType, 'ok');
  });

  it('Deploy Contract', async () => {
    contract = await client.getContractInstance(TOKEN_VOTING);

    const metadata = {
      title: "Testing",
      description: "This Poll is created for Testing purposes only",
      link: "https://aeternity.com/",
      spec_ref: undefined
    };

    const vote_options = {0: "Yes", 1: "No"};
    const close_height = (await client.height()) + 50;

    const init = await contract.methods.init(metadata, vote_options, close_height, token.deployInfo.address);
    assert.equal(init.result.returnType, 'ok');
  });

});
