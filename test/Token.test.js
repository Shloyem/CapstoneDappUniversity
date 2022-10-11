const { tokens, EVM_REVERT } = require('./helpers');
const Token = artifacts.require("Token");

require('chai').use(require('chai-as-promised')).should()

contract('Token', ([deployer, receiver]) => {
  const name = 'DApp Token';
  const symbol = 'DAPP';
  const decimals = '18';
  const totalSupply = tokens(1000000).toString();
  let token;

  beforeEach(async () => {
    token = await Token.new();
  })
  describe('deployment', () => {
    it('describe the name', async () => {
      const result = await token.name();
      result.should.equal(name);
    })
    it('tracks the symbol', async () => {
      const result = await token.symbol();
      result.should.equal(symbol);
    })
    it('tracks the decimals', async () => {
      const result = await token.decimals();
      result.toString().should.equal(decimals);
    })
    it('tracks the total supply', async () => {
      const result = await token.totalSupply();
      result.toString().should.equal(totalSupply);
    })
    it('assigns the total amount to the deployer', async () => {
      const balance = await token.balanceOf(deployer);
      balance.toString().should.equal(totalSupply);
    })
  })

  describe('sending tokens', () => {
    let amount = tokens(100);
    let result;

    describe('success', () => {
      beforeEach(async () => {
        result = await token.transfer(receiver, amount.toString(), { from: deployer });
      })

      it('Transfer token balances', async () => {
        let balanceOf;
        balanceOf = await token.balanceOf(deployer);
        balanceOf.toString().should.equal(tokens(999900).toString());
        balanceOf = await token.balanceOf(receiver);
        balanceOf.toString().should.equal(tokens(100).toString());
      })

      it('Emits a transfer event', async () => {
        const log = result.logs[0];
        log.event.should.equal('Transfer');
        const event = log.args;
        event._from.should.equal(deployer, 'from is incorrect');
        event._to.should.equal(receiver, 'to is incorrect');
        event._value.toString().should.equal((amount).toString(), 'amount is incorrect');

      })
    })

    describe('failure', () => {
      it('rejects insufficient balances', async () => {
        let invalidAmount = tokens(100000000); // 100 million - greater than total supply
        await token.transfer(receiver, invalidAmount, { from: deployer }).should.be.rejectedWith(EVM_REVERT);

        // Attempt transfer tokens, when you have none
        invalidAmount = tokens(10); // receiver has no tokens
        await token.transfer(deployer, invalidAmount, { from: receiver }).should.be.rejectedWith(EVM_REVERT);
      })

      it('rejects invalid recipients', async () => {
        await token.transfer(0x0, amount, { from: deployer }).should.be.rejected;
      })
    })
  })
})