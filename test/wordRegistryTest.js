const fs = require('fs');
const assert = require('chai').assert
const {defaultWallets: wallets} = require('../config/wallets.json');

const {Universal, MemoryAccount, Node} = require('@aeternity/aepp-sdk');
const WORD_REGISTRY = fs.readFileSync('./contracts/WordRegistry.aes', 'utf-8');
const WORD_REGISTRY_INTERFACE = fs.readFileSync('./contracts/interfaces/WordRegistryInterface.aes', 'utf-8');
const TOKEN_SALE = fs.readFileSync('./contracts/TokenSale.aes', 'utf-8');
const TOKEN = fs.readFileSync('./contracts/FungibleTokenCustom.aes', 'utf-8');
const BONDING_CURVE = require('sophia-bonding-curve/BondCurveLinear.aes')

const config = {
  url: 'http://localhost:3001/',
  internalUrl: 'http://localhost:3001/',
  compilerUrl: 'http://localhost:3080'
};

describe('WordRegistry Contract', () => {
  let client, contract, token, sale, bondingCurve;

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

  it('Deploy Bonding Curve', async () => {
    bondingCurve = await client.getContractInstance(BONDING_CURVE);
    const init = await bondingCurve.methods.init();
    assert.equal(init.result.returnType, 'ok');
  });

  it('Deploy Token Sale', async () => {
    sale = await client.getContractInstance(TOKEN_SALE);
    const init = await sale.methods.init(20, bondingCurve.deployInfo.address, "description");
    assert.equal(init.result.returnType, 'ok');
  });

  it('Deploy and add Token', async () => {
    token = await client.getContractInstance(TOKEN);
    const init = await token.methods.init("Test Token", 0, "TT", sale.deployInfo.address, contract.deployInfo.address);
    assert.equal(init.result.returnType, 'ok');
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

  it('Check Interface', async () => {
    const registryInterface = await client.getContractInstance(WORD_REGISTRY_INTERFACE, {contractAddress: contract.deployInfo.address});
    const registryState = await registryInterface.methods.get_state();
    assert.equal(registryState.result.returnType, 'ok');
  });
});
