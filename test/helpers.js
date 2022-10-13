
require('chai').use(require('chai-as-promised')).should()

const ETHER_ADDRESS = '0x0000000000000000000000000000000000000000';

const EVM_REVERT = 'Returned error: VM Exception while processing transaction: revert'

const ether = (n) => {
  return new web3.utils.BN(
    web3.utils.toWei(n.toString(), 'ether')
  )
}

// Same as Ether
const tokens = (n) => ether(n)

const assertEvent = (eventLog, eventName, expectedArgsNameAndValue) => {
  eventLog.event.should.equal(eventName);
  const eventArgs = eventLog.args;

  for (const [key, expValue] of Object.entries(expectedArgsNameAndValue)) {
    eventArgs[key].toString().should.equal(expValue.toString());
  }
}

module.exports = { tokens, ether, EVM_REVERT, ETHER_ADDRESS, assertEvent }