const BigNumber = require('bignumber.js');
const assert = require('chai').assert
const {readFileRelative} = require('aeproject-utils/utils/fs-utils');
const {defaultWallets: wallets} = require('aeproject-config/config/node-config.json');

const {Universal, MemoryAccount, Node} = require('@aeternity/aepp-sdk');
const requireESM = require('esm')(module); // use to handle es6 import/export
const {decodeEvents, SOPHIA_TYPES} = requireESM('@aeternity/aepp-sdk/es/contract/aci/transformation');

const TOKEN_SALE = readFileRelative('./contracts/TokenSale.aes', 'utf-8');
const TOKEN_SALE_INTERFACE = readFileRelative('./contracts/interfaces/TokenSaleInterface.aes', 'utf-8');
const TOKEN = readFileRelative('./contracts/FungibleTokenCustom.aes', 'utf-8');
const TOKEN_VOTING = readFileRelative('./contracts/TokenVoting.aes', 'utf-8');
const TOKEN_VOTING_INTERFACE = readFileRelative('./contracts/interfaces/TokenVotingInterface.aes', 'utf-8');
const BONDING_CURVE = require('sophia-bonding-curve/BondCurveLinear.aes')

const config = {
  url: 'http://localhost:3001/',
  internalUrl: 'http://localhost:3001/',
  compilerUrl: 'http://localhost:3080'
};

describe('Token- Sale and Voting Contracts', () => {
  let client, sale, voting, token, bondingCurve;

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

  const eventsSchema = [
    {name: 'AddVote', types: [SOPHIA_TYPES.address, SOPHIA_TYPES.int]},
    {name: 'Buy', types: [SOPHIA_TYPES.address, SOPHIA_TYPES.int, SOPHIA_TYPES.int]},
    {name: 'Sell', types: [SOPHIA_TYPES.address, SOPHIA_TYPES.int, SOPHIA_TYPES.int]}
  ];

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
      subject: {"VotePayout": [wallets[2].publicKey]},
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

    const decodedEvents = decodeEvents(addVote.txData.log, {schema: eventsSchema});
    assert.equal(`ct_${decodedEvents[0].decoded[0]}`, voting.deployInfo.address);
    assert.equal(decodedEvents[0].decoded[1], 0);

    const votes = await sale.methods.votes();
    assert.deepEqual(votes.decodedResult, [[0, [false, voting.deployInfo.address]]]);
  })

  it('Buy Tokens', async () => {
    const buyValue = await sale.methods.calculate_buy_price(5);
    assert.equal(buyValue.decodedResult, 18)

    const buy = await sale.methods.buy(5, {amount: buyValue.decodedResult});
    assert.equal(buy.result.returnType, 'ok');

    const decodedEvents = decodeEvents(buy.txData.log, {schema: eventsSchema});
    assert.equal(`ak_${decodedEvents[0].decoded[0]}`, wallets[0].publicKey);
    assert.equal(decodedEvents[0].decoded[1], buyValue.decodedResult);
    assert.equal(decodedEvents[0].decoded[2], 5);

    const amount = await token.methods.balance(wallets[0].publicKey);
    assert.equal(amount.decodedResult, 5)
    assert.equal(await client.getBalance(sale.deployInfo.address.replace('ct_', 'ak_')), 18)
  });

  it('Sell Tokens', async () => {
    await token.methods.create_allowance(sale.deployInfo.address.replace('ct_', 'ak_'), 4);
    const sell = await sale.methods.sell(4);
    assert.equal(sell.result.returnType, 'ok');

    const decodedEvents = decodeEvents(sell.txData.log, {schema: eventsSchema});
    assert.equal(`ak_${decodedEvents[0].decoded[0]}`, wallets[0].publicKey);
    assert.equal(decodedEvents[0].decoded[1], 12);
    assert.equal(decodedEvents[0].decoded[2], 4);

    const amount = await token.methods.balance(wallets[0].publicKey);
    assert.equal(amount.decodedResult, 1);
    assert.equal(await client.getBalance(sale.deployInfo.address.replace('ct_', 'ak_')), 6)
  });

  it('Spread', async () => {
    const buyValue = await sale.methods.calculate_buy_price(5);
    const buy = await sale.methods.buy(5, {amount: buyValue.decodedResult});
    assert.equal(buy.result.returnType, 'ok');

    assert.equal(await client.getBalance(sale.deployInfo.address.replace('ct_', 'ak_')), 29)

    const spread = await sale.methods.spread();
    assert.equal(spread.decodedResult, 11);
  });

  it('Vote', async () => {
    // prepare to have 100 tokens for later tests
    const buyAmount = 100 - (await token.methods.balance(wallets[0].publicKey)).decodedResult
    const buyValue = await sale.methods.calculate_buy_price(buyAmount);

    await sale.methods.buy(buyAmount, {amount: buyValue.decodedResult});

    await token.methods.create_allowance(voting.deployInfo.address.replace('ct_', 'ak_'), 10);
    const vote = await voting.methods.vote(true, 10);
    assert.equal(vote.result.returnType, 'ok');

    const tokenBalanceContract = (await token.methods.balance(voting.deployInfo.address.replace('ct_', 'ak_'))).decodedResult;
    assert.equal(tokenBalanceContract, 10);
    const tokenBalanceAccount = (await token.methods.balance(wallets[0].publicKey)).decodedResult;
    assert.equal(tokenBalanceAccount, 90);
    const currentVoteState = (await voting.methods.current_vote_state()).decodedResult;
    assert.deepEqual(currentVoteState, [[false, 0], [true, 10]])
  });

  it('Revoke Vote', async () => {
    const vote = await voting.methods.revoke_vote();
    assert.equal(vote.result.returnType, 'ok');

    const tokenBalanceContract = (await token.methods.balance(voting.deployInfo.address.replace('ct_', 'ak_'))).decodedResult;
    assert.equal(tokenBalanceContract, 0);
    const tokenBalanceAccount = (await token.methods.balance(wallets[0].publicKey)).decodedResult;
    assert.equal(tokenBalanceAccount, 100);
    const currentVoteState = (await voting.methods.current_vote_state()).decodedResult;
    assert.deepEqual(currentVoteState, [[false, 0], [true, 0]])
  });

  it('Withdraw', async () => {
    await token.methods.change_allowance(voting.deployInfo.address.replace('ct_', 'ak_'), 70);
    const vote = await voting.methods.vote(true, 70);
    assert.equal(vote.result.returnType, 'ok');
    const tokenBalanceContract = (await token.methods.balance(voting.deployInfo.address.replace('ct_', 'ak_'))).decodedResult;
    assert.equal(tokenBalanceContract, 70);
    const tokenBalanceAccount = (await token.methods.balance(wallets[0].publicKey)).decodedResult;
    assert.equal(tokenBalanceAccount, 30);
    const currentVoteState = (await voting.methods.current_vote_state()).decodedResult;
    assert.deepEqual(currentVoteState, [[false, 0], [true, 70]])

    await client.awaitHeight((await voting.methods.close_height()).decodedResult, {attempts: 100});
    const withdraw = await voting.methods.withdraw();
    assert.equal(withdraw.result.returnType, 'ok');

    const tokenBalanceContractAfter = (await token.methods.balance(voting.deployInfo.address.replace('ct_', 'ak_'))).decodedResult;
    assert.equal(tokenBalanceContractAfter, 0);
    const tokenBalanceAccountAfter = (await token.methods.balance(wallets[0].publicKey)).decodedResult;
    assert.equal(tokenBalanceAccountAfter, 100);
    const currentVoteStateAfter = (await voting.methods.final_vote_state()).decodedResult;
    assert.deepEqual(currentVoteStateAfter, [[false, 0], [true, 70]])
  });

  it('Apply vote subject in Sale', async () => {
    const balanceBefore = await client.getBalance(wallets[2].publicKey);

    const expectedSpread = await client.getBalance(sale.deployInfo.address.replace('ct_', 'ak_')) - (await sale.methods.calculate_sell_return(100)).decodedResult
    assert.equal(expectedSpread, 105);

    const applyVoteSubject = await sale.methods.apply_vote_subject(0);
    assert.equal(applyVoteSubject.result.returnType, 'ok');

    const balanceAfter = await client.getBalance(wallets[2].publicKey);
    assert.equal(new BigNumber(balanceAfter).toFixed(), new BigNumber(balanceBefore).plus(expectedSpread).toFixed());

    assert.equal((await sale.methods.spread()).decodedResult, 0);

    const votes = await sale.methods.votes();
    assert.deepEqual(votes.decodedResult, [[0, [true, voting.deployInfo.address]]]);
  });

  it('Check Interface', async () => {
    const saleInterface = await client.getContractInstance(TOKEN_SALE_INTERFACE, {contractAddress: sale.deployInfo.address});
    const saleState = await saleInterface.methods.get_state();
    assert.equal(saleState.result.returnType, 'ok');

    const votingInterface = await client.getContractInstance(TOKEN_VOTING_INTERFACE, {contractAddress: voting.deployInfo.address});
    const votingState = await votingInterface.methods.get_state();
    assert.equal(votingState.result.returnType, 'ok');
  });

  //TODO test negative case vote already applied
  //TODO test negative case less than 50% stake
  //TODO test negative vote timeout
});
