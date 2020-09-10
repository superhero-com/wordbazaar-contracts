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
    const init = await token.methods.init("Test Token", 0, "TT", 100);
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
    const close_height = (await client.height()) + 15;

    const init = await contract.methods.init(metadata, vote_options, close_height, token.deployInfo.address);
    assert.equal(init.result.returnType, 'ok');
  });

  it('Vote', async () => {
    await token.methods.create_allowance(contract.deployInfo.address.replace('ct_', 'ak_'), 10);
    const vote = await contract.methods.vote(0, 10);
    assert.equal(vote.result.returnType, 'ok');

    const tokenBalanceContract = (await token.methods.balance(contract.deployInfo.address.replace('ct_', 'ak_'))).decodedResult;
    assert.equal(tokenBalanceContract, 10);
    const tokenBalanceAccount = (await token.methods.balance(wallets[0].publicKey)).decodedResult;
    assert.equal(tokenBalanceAccount, 90);
    const currentVoteState = (await contract.methods.current_vote_state()).decodedResult;
    assert.deepEqual(currentVoteState, [[0, 10]])
  });

  it('Revoke Vote', async () => {
    const vote = await contract.methods.revoke_vote();
    assert.equal(vote.result.returnType, 'ok');

    const tokenBalanceContract = (await token.methods.balance(contract.deployInfo.address.replace('ct_', 'ak_'))).decodedResult;
    assert.equal(tokenBalanceContract, 0);
    const tokenBalanceAccount = (await token.methods.balance(wallets[0].publicKey)).decodedResult;
    assert.equal(tokenBalanceAccount, 100);
    const currentVoteState = (await contract.methods.current_vote_state()).decodedResult;
    assert.deepEqual(currentVoteState, [[0, 0]])
  });

  it('Withdraw', async () => {
    await token.methods.change_allowance(contract.deployInfo.address.replace('ct_', 'ak_'), 20);
    const vote = await contract.methods.vote(0, 20);
    assert.equal(vote.result.returnType, 'ok');
    const tokenBalanceContract = (await token.methods.balance(contract.deployInfo.address.replace('ct_', 'ak_'))).decodedResult;
    assert.equal(tokenBalanceContract, 20);
    const tokenBalanceAccount = (await token.methods.balance(wallets[0].publicKey)).decodedResult;
    assert.equal(tokenBalanceAccount, 80);
    const currentVoteState = (await contract.methods.current_vote_state()).decodedResult;
    assert.deepEqual(currentVoteState, [[0, 20]])


    await client.awaitHeight((await contract.methods.close_height()).decodedResult);
    const withdraw = await contract.methods.withdraw();
    assert.equal(withdraw.result.returnType, 'ok');

    const tokenBalanceContractAfter = (await token.methods.balance(contract.deployInfo.address.replace('ct_', 'ak_'))).decodedResult;
    assert.equal(tokenBalanceContractAfter, 0);
    const tokenBalanceAccountAfter = (await token.methods.balance(wallets[0].publicKey)).decodedResult;
    assert.equal(tokenBalanceAccountAfter, 100);
    const currentVoteStateAfter = (await contract.methods.final_vote_state()).decodedResult;
    assert.deepEqual(currentVoteStateAfter, [[0, 20]])
  });

});
