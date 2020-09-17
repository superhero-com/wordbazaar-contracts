const assert = require('chai').assert
const {readFileRelative} = require('aeproject-utils/utils/fs-utils');
const {defaultWallets: wallets} = require('aeproject-config/config/node-config.json');

const {Universal, MemoryAccount, Node} = require('@aeternity/aepp-sdk');
const TOKEN_SALE = readFileRelative('./contracts/TokenSale.aes', 'utf-8');
const TOKEN = readFileRelative('./contracts/FungibleTokenCustom.aes', 'utf-8');

const config = {
  url: 'http://localhost:3001/',
  internalUrl: 'http://localhost:3001/',
  compilerUrl: 'http://localhost:3080'
};

describe('TokenSale Contract', () => {
  let client, contract, token;

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

  it('Deploy Contract', async () => {
    contract = await client.getContractInstance(TOKEN_SALE);
    const init = await contract.methods.init();
    assert.equal(init.result.returnType, 'ok');
  });

  it('Deploy and set Token', async () => {
    token = await client.getContractInstance(TOKEN);
    const init = await token.methods.init("Test Token", 0, "TT", contract.deployInfo.address.replace('ct_', 'ak_'));
    assert.equal(init.result.returnType, 'ok');
    const set = await contract.methods.set_token(token.deployInfo.address);
    assert.equal(set.result.returnType, 'ok');
  });

  it('Buy Tokens', async () => {
    const buy = await contract.methods.buy({amount: 21});
    assert.equal(buy.result.returnType, 'ok');

    const amount = await token.methods.balance(wallets[0].publicKey);
    assert.equal(amount.decodedResult, 21)
    assert.equal(await client.getBalance(contract.deployInfo.address.replace('ct_', 'ak_')), 21)
  });

  it('Sell Tokens', async () => {
    await token.methods.create_allowance(contract.deployInfo.address.replace('ct_', 'ak_'), 11);
    const sell = await contract.methods.sell(11);
    assert.equal(sell.result.returnType, 'ok');

    const amount = await token.methods.balance(wallets[0].publicKey);
    assert.equal(amount.decodedResult, 10);
    assert.equal(await client.getBalance(contract.deployInfo.address.replace('ct_', 'ak_')), 10 + 6)

  });

  it('Spread', async () => {
    const buy = await contract.methods.buy({amount: 10});
    assert.equal(buy.result.returnType, 'ok');

    assert.equal(await client.getBalance(contract.deployInfo.address.replace('ct_', 'ak_')), 10 + 10 + 6)

    const spread = await contract.methods.spread();
    assert.equal(spread.decodedResult, 6);
  });
});
