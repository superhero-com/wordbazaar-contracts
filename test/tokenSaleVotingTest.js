const assert = require('chai').assert
const {readFileRelative} = require('aeproject-utils/utils/fs-utils');
const {defaultWallets: wallets} = require('aeproject-config/config/node-config.json');

const {Universal, MemoryAccount, Node} = require('@aeternity/aepp-sdk');
const TOKEN_SALE = readFileRelative('./contracts/TokenSale.aes', 'utf-8');
const TOKEN = readFileRelative('./contracts/FungibleTokenCustom.aes', 'utf-8');
const TOKEN_VOTING = readFileRelative('./contracts/TokenVoting.aes', 'utf-8');

const config = {
  url: 'http://localhost:3001/',
  internalUrl: 'http://localhost:3001/',
  compilerUrl: 'http://localhost:3080'
};

describe('Token- Sale and Voting Contracts', () => {
  let client, sale, voting, token;

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

  it('Deploy Token Sale', async () => {
    sale = await client.getContractInstance(TOKEN_SALE);
    const init = await sale.methods.init();
    assert.equal(init.result.returnType, 'ok');
  });

  it('Deploy and set Token', async () => {
    token = await client.getContractInstance(TOKEN);
    const init = await token.methods.init("Test Token", 0, "TT", sale.deployInfo.address.replace('ct_', 'ak_'));
    assert.equal(init.result.returnType, 'ok');
    const set = await sale.methods.set_token(token.deployInfo.address);
    assert.equal(set.result.returnType, 'ok');
  });

  it('Deploy Voting Contract', async () => {
    voting = await client.getContractInstance(TOKEN_VOTING);

    const metadata = {
      subject: {"VotePayout": [wallets[1].publicKey]},
      description: "This Poll is created for Testing purposes only",
      link: "https://aeternity.com/"
    };

    const close_height = (await client.height()) + 40;
    const init = await voting.methods.init(metadata, close_height, token.deployInfo.address);
    assert.equal(init.result.returnType, 'ok');
  });

  it('Add Vote in Sale', async () => {
    const addVote = await sale.methods.add_vote(voting.deployInfo.address);
    assert.equal(addVote.result.returnType, 'ok');

    const votes = await sale.methods.votes();
    assert.deepEqual(votes.decodedResult, [[0, voting.deployInfo.address]]);
  })

  it('Buy Tokens', async () => {
    const buy = await sale.methods.buy({amount: 21});
    assert.equal(buy.result.returnType, 'ok');

    const amount = await token.methods.balance(wallets[0].publicKey);
    assert.equal(amount.decodedResult, 21)
    assert.equal(await client.getBalance(sale.deployInfo.address.replace('ct_', 'ak_')), 21)
  });

  it('Sell Tokens', async () => {
    await token.methods.create_allowance(sale.deployInfo.address.replace('ct_', 'ak_'), 11);
    const sell = await sale.methods.sell(11);
    assert.equal(sell.result.returnType, 'ok');

    const amount = await token.methods.balance(wallets[0].publicKey);
    assert.equal(amount.decodedResult, 10);
    assert.equal(await client.getBalance(sale.deployInfo.address.replace('ct_', 'ak_')), 10 + 6)

  });

  it('Spread', async () => {
    const buy = await sale.methods.buy({amount: 10});
    assert.equal(buy.result.returnType, 'ok');

    assert.equal(await client.getBalance(sale.deployInfo.address.replace('ct_', 'ak_')), 10 + 10 + 6)

    const spread = await sale.methods.spread();
    assert.equal(spread.decodedResult, 6);
  });

  it('Vote', async () => {
    // prepare to have 100 tokens for later tests
    await sale.methods.buy({amount: 100 - (await token.methods.balance(wallets[0].publicKey)).decodedResult});

    await token.methods.create_allowance(voting.deployInfo.address.replace('ct_', 'ak_'), 10);
    const vote = await voting.methods.vote(true, 10);
    assert.equal(vote.result.returnType, 'ok');

    const tokenBalanceContract = (await token.methods.balance(voting.deployInfo.address.replace('ct_', 'ak_'))).decodedResult;
    assert.equal(tokenBalanceContract, 10);
    const tokenBalanceAccount = (await token.methods.balance(wallets[0].publicKey)).decodedResult;
    assert.equal(tokenBalanceAccount, 90);
    const currentVoteState = (await voting.methods.current_vote_state()).decodedResult;
    assert.deepEqual(currentVoteState, [[true, 10]])
  });

  it('Revoke Vote', async () => {
    const vote = await voting.methods.revoke_vote();
    assert.equal(vote.result.returnType, 'ok');

    const tokenBalanceContract = (await token.methods.balance(voting.deployInfo.address.replace('ct_', 'ak_'))).decodedResult;
    assert.equal(tokenBalanceContract, 0);
    const tokenBalanceAccount = (await token.methods.balance(wallets[0].publicKey)).decodedResult;
    assert.equal(tokenBalanceAccount, 100);
    const currentVoteState = (await voting.methods.current_vote_state()).decodedResult;
    assert.deepEqual(currentVoteState, [[true, 0]])
  });

  it('Withdraw', async () => {
    await token.methods.change_allowance(voting.deployInfo.address.replace('ct_', 'ak_'), 20);
    const vote = await voting.methods.vote(true, 20);
    assert.equal(vote.result.returnType, 'ok');
    const tokenBalanceContract = (await token.methods.balance(voting.deployInfo.address.replace('ct_', 'ak_'))).decodedResult;
    assert.equal(tokenBalanceContract, 20);
    const tokenBalanceAccount = (await token.methods.balance(wallets[0].publicKey)).decodedResult;
    assert.equal(tokenBalanceAccount, 80);
    const currentVoteState = (await voting.methods.current_vote_state()).decodedResult;
    assert.deepEqual(currentVoteState, [[true, 20]])

    await client.awaitHeight((await voting.methods.close_height()).decodedResult);
    const withdraw = await voting.methods.withdraw();
    assert.equal(withdraw.result.returnType, 'ok');

    const tokenBalanceContractAfter = (await token.methods.balance(voting.deployInfo.address.replace('ct_', 'ak_'))).decodedResult;
    assert.equal(tokenBalanceContractAfter, 0);
    const tokenBalanceAccountAfter = (await token.methods.balance(wallets[0].publicKey)).decodedResult;
    assert.equal(tokenBalanceAccountAfter, 100);
    const currentVoteStateAfter = (await voting.methods.final_vote_state()).decodedResult;
    assert.deepEqual(currentVoteStateAfter, [[true, 20]])
  });
});
