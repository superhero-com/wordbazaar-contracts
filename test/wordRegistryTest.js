const assert = require('chai').assert
const {readFileRelative} = require('aeproject-utils/utils/fs-utils');
const {defaultWallets: wallets} = require('aeproject-config/config/node-config.json');

const {Universal, MemoryAccount, Node} = require('@aeternity/aepp-sdk');
const WORD_REGISTRY = readFileRelative('./contracts/WordRegistry.aes', 'utf-8');
const TOKEN_SALE = readFileRelative('./contracts/TokenSale.aes', 'utf-8');
const TOKEN = readFileRelative('./contracts/FungibleTokenCustom.aes', 'utf-8');

const config = {
  url: 'http://localhost:3001/',
  internalUrl: 'http://localhost:3001/',
  compilerUrl: 'http://localhost:3080'
};

describe('WordRegistry Contract', () => {
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

  it('Deploy Contract', async () => {
    contract = await client.getContractInstance(WORD_REGISTRY);
    const init = await contract.methods.init();
    assert.equal(init.result.returnType, 'ok');
  });

  it('Deploy Token Sale', async () => {
    sale = await client.getContractInstance(TOKEN_SALE);
    const init = await sale.methods.init(20);
    assert.equal(init.result.returnType, 'ok');
  });

  it('Deploy and add Token', async () => {
    token = await client.getContractInstance(TOKEN);
    const init = await token.methods.init("Test Token", 0, "TT", contract.deployInfo.address.replace('ct_', 'ak_'));
    assert.equal(init.result.returnType, 'ok');
    await sale.methods.set_token(token.deployInfo.address);
    const set = await contract.methods.add_token(sale.deployInfo.address);
    assert.equal(set.result.returnType, 'ok');
  });

  it('Get State', async () => {
    const state = await contract.methods.get_state();
    assert.deepEqual(state.decodedResult, { tokens: [["TT", sale.deployInfo.address]], owner: wallets[0].publicKey});
  });

  it('Remove Token', async () => {
    const remove = await contract.methods.remove_token("TT",);
    assert.equal(remove.result.returnType, 'ok');

    const state = await contract.methods.get_state();
    assert.deepEqual(state.decodedResult, { tokens: [], owner: wallets[0].publicKey});
  });
});
