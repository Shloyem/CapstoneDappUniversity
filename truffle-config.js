require('babel-register');
require('babel-polyfill');
require('dotenv').config();

const GANACHE_WSL_INTERFACE = process.env.GANACHE_WSL_INTERFACE;

module.exports = {
  networks: {
    development: {
      host: GANACHE_WSL_INTERFACE,
      port: 7545,
      network_id: "*",// Match any network id
      networkCheckTimeout: 30000
    },
  },
  contracts_directory: './src/contracts/',
  contracts_build_directory: './src/abis/',
  compilers: {
    solc: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  }
}
