const fs = require('fs');
const {Universal, Node, MemoryAccount} = require('@aeternity/aepp-sdk');
const WORD_REGISTRY = fs.readFileSync('../contracts/WordRegistry.aes', 'utf-8');

const deploy = async () => {

  const config = {
    url: 'https://testnet.aeternity.io/',
    compilerUrl: 'https://compiler.aepps.com'
  };

  const keypair = {
    secretKey: '8fe6f2b3eaee2cc675de41cc8f5c22fad204b740611e8b8593524ce356eb2ab5c5127b909da4e7eddec87a2f22dea0cd56e9168fdb9f98cccd0adda77e741dd2',
    publicKey: 'ak_2VnwoJPQgrXvreUx2L9BVvd9BidWwpu1ASKK1AMre21soEgpRT'
  };

  const client = await Universal({
    nodes: [{
      name: 'node',
      instance: await Node(config)
    }],
    accounts: [MemoryAccount({keypair})],
    compilerUrl: config.compilerUrl
  });

  const contract = await client.getContractInstance(WORD_REGISTRY)
  const init = await contract.methods.init();
  console.log(init);
};

deploy();
