const fs = require('fs');

const FungibleTokenCustom = fs.readFileSync(__dirname + '/../contracts/FungibleTokenCustom.aes', 'utf-8');
fs.writeFileSync(__dirname + '/../FungibleTokenCustom.aes.js', `module.exports = \`\n${FungibleTokenCustom.replace(/`/g, "\\`")}\`;\n`, 'utf-8');

const TokenSale = fs.readFileSync(__dirname + '/../contracts/TokenSale.aes', 'utf-8');
fs.writeFileSync(__dirname + '/../TokenSale.aes.js', `module.exports = \`\n${TokenSale.replace(/`/g, "\\`")}\`;\n`, 'utf-8');

const WordRegistry = fs.readFileSync(__dirname + '/../contracts/WordRegistry.aes', 'utf-8');
fs.writeFileSync(__dirname + '/../WordRegistry.aes.js', `module.exports = \`\n${WordRegistry.replace(/`/g, "\\`")}\`;\n`, 'utf-8');

const TokenVoting = fs.readFileSync(__dirname + '/../contracts/TokenVoting.aes', 'utf-8');
fs.writeFileSync(__dirname + '/../TokenVoting.aes.js', `module.exports = \`\n${TokenVoting.replace(/`/g, "\\`")}\`;\n`, 'utf-8');
