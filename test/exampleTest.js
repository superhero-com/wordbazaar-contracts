const assert = require('chai').assert
const {readFileRelative} = require('aeproject-utils/utils/fs-utils');
const {defaultWallets: wallets} = require('aeproject-config/config/node-config.json');

const {Universal, MemoryAccount, Node} = require('@aeternity/aepp-sdk');
const EXAMPLE_CONTRACT = readFileRelative('./contracts/ExampleContract.aes', 'utf-8');

const config = {
  url: 'http://localhost:3001/',
  internalUrl: 'http://localhost:3001/',
  compilerUrl: 'http://localhost:3080'
};

describe('Example Contract', () => {
  let client, contract;

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

  it('Deploying Contract', async () => {
    contract = await client.getContractInstance(EXAMPLE_CONTRACT);
    const init = await contract.methods.init();
    assert.equal(init.result.returnType, 'ok');
  });

  it('Set Value', async () => {
    const set = await contract.methods.set(1, 'test');
    assert.equal(set.result.returnType, 'ok');
  });

  it('Get Value', async () => {
    const get = await contract.methods.get(1);
    assert.equal(get.decodedResult, 'test');
  });

});
