const fs = require('fs');
const {Universal, Node, MemoryAccount} = require('@aeternity/aepp-sdk');
const WORD_REGISTRY = fs.readFileSync('../contracts/WordRegistry.aes', 'utf-8');

const deploy = async () => {

  const config = {
    url: 'https://testnet.aeternity.io/',
    compilerUrl: 'https://compiler.aepps.com'
  };

  const keypair = {
    secretKey: '',
    publicKey: ''
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
