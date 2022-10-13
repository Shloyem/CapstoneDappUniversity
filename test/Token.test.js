const { tokens, EVM_REVERT, assertEvent } = require('./helpers');
const Token = artifacts.require("Token");

require('chai').use(require('chai-as-promised')).should()

contract('Token', ([deployer, receiver, exchange]) => {
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
    let amount;
    let result;

    describe('success', () => {
      beforeEach(async () => {
        amount = tokens(100);
        result = await token.transfer(receiver, amount, { from: deployer });
      })

      it('transfer token balances', async () => {
        let balanceOf;
        balanceOf = await token.balanceOf(deployer);
        balanceOf.toString().should.equal(tokens(999900).toString());
        balanceOf = await token.balanceOf(receiver);
        balanceOf.toString().should.equal(tokens(100).toString());
      })

      it('emits a Transfer event', async () => {
        const eventLog = result.logs[0];

        assertEvent(eventLog, 'Transfer',
          {
            _from: deployer,
            _to: receiver,
            _value: amount
          });
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

  describe('approving tokens', () => {
    let result, amount;

    beforeEach(async () => {
      amount = tokens(100);
      result = await token.approve(exchange, amount, { from: deployer })
    })

    describe('success', () => {
      it('allocates an allowance for delegated token spending', async () => {
        const allowance = await token.allowance(deployer, exchange);
        allowance.toString().should.equal(amount.toString());
      })

      it('emits an Approval event', async () => {
        const eventLog = result.logs[0];

        assertEvent(eventLog, 'Approval',
          {
            _owner: deployer,
            _spender: exchange,
            _value: amount
          });
      })
    })

    describe('failure', () => {
      it('rejects invalid spender', async () => {
        await token.approve(0x0, amount, { from: deployer }).should.be.rejected;
      })
    })
  })

  describe('delegated token transfers', () => {
    let amount;
    let result;

    beforeEach(async () => {
      amount = tokens(100);
      await token.approve(exchange, amount, { from: deployer });
    })

    describe('success', () => {
      beforeEach(async () => {
        result = await token.transferFrom(deployer, receiver, amount, { from: exchange });
      })

      it('transfer token balances', async () => {
        let balanceOf;
        balanceOf = await token.balanceOf(deployer);
        balanceOf.toString().should.equal(tokens(999900).toString());
        balanceOf = await token.balanceOf(receiver);
        balanceOf.toString().should.equal(tokens(100).toString());
      })

      it('resets the allowance', async () => {
        const allowance = await token.allowance(deployer, exchange);
        allowance.toString().should.equal('0');
      })

      it('emits a Transfer event', async () => {
        const eventLog = result.logs[0];

        assertEvent(eventLog, 'Transfer',
          {
            _from: deployer,
            _to: receiver,
            _value: amount
          });
      })
    })

    describe('failure', () => {
      it('rejects insufficient amounts', async () => {
        // Attempt transfer too many tokens - greater than total supply
        let invalidAmount = tokens(100000000);
        await token.transferFrom(deployer, receiver, invalidAmount, { from: exchange }).should.be.rejectedWith(EVM_REVERT);
      })

      it('rejects amount greater than approved', async () => {
        let invalidAmount = tokens(amount + 1);
        await token.transferFrom(deployer, receiver, invalidAmount, { from: exchange }).should.be.rejectedWith(EVM_REVERT);
      })

      it('rejects invalid recipients', async () => {
        await token.transferFrom(deployer, 0x0, amount, { from: exchange }).should.be.rejected;
      })
    })
  })
})