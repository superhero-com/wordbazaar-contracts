const fs = require('fs');

const exampleContract = fs.readFileSync(__dirname + '/../contracts/ExampleContract.aes', 'utf-8');

fs.writeFileSync(__dirname + '/../ExampleContract.aes.js', `module.exports = \`\n${exampleContract}\`;\n`, 'utf-8');
