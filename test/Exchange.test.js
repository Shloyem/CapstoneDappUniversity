const { tokens, ether, EVM_REVERT, ETHER_ADDRESS, assertEvent } = require('./helpers');
const Token = artifacts.require("Token");
const Exchange = artifacts.require("Exchange");

require('chai').use(require('chai-as-promised')).should()

contract('Exchange', ([deployer, feeAccount, user1]) => {
  let token, exchange;
  const feePercent = 10;

  beforeEach(async () => {
    // Deploy token
    token = await Token.new();

    // Transfer some tokens to user1
    token.transfer(user1, tokens(100), { from: deployer })

    // Deploy exchange
    exchange = await Exchange.new(feeAccount, feePercent);
  })

  describe('deployment', () => {
    it('tracks the fee account', async () => {
      const result = await exchange.feeAccount();
      result.should.equal(feeAccount);
    })

    it('tracks the fee percent', async () => {
      const result = await exchange.feePercent();
      result.toString().should.equal(feePercent.toString());
    })
  })

  describe('fallback', () => {
    it('reverts when ether is sent', async () => {
      await exchange.sendTransaction({ value: 1, from: user1 }).should.be.rejectedWith(EVM_REVERT);
    })
  })

  describe('depositing Ether', () => {
    let result;
    let amount;

    beforeEach(async () => {
      amount = ether(1);
      result = await exchange.depositEther({ from: user1, value: amount })
    })

    it('tracks the Ether deposit', async () => {
      let exchangeBalance = await web3.eth.getBalance(exchange.address);
      exchangeBalance.toString().should.equal(amount.toString());
      let userBalanceInExchange = await exchange.tokens(ETHER_ADDRESS, user1);
      userBalanceInExchange.toString().should.equal(amount.toString());
    })

    it('emits a Deposit event', async () => {
      const eventLog = result.logs[0];

      assertEvent(eventLog, 'Deposit',
        {
          _token: ETHER_ADDRESS,
          _user: user1,
          _amount: amount,
          _balance: amount
        });
    })
  })

  describe('withdraw Ether', () => {
    let result;
    let amount;

    beforeEach(async () => {
      amount = ether(1);
      await exchange.depositEther({ from: user1, value: amount })
    })

    describe('success', () => {
      beforeEach(async () => {
        result = await exchange.withdrawEther(amount, { from: user1 });
      })

      it('withdrawing Ether', async () => {
        const exchangeBalance = await web3.eth.getBalance(exchange.address);
        exchangeBalance.toString().should.equal('0');
        const userBalanceInExchange = await exchange.tokens(ETHER_ADDRESS, user1);
        userBalanceInExchange.toString().should.equal('0');
      })

      it('emits a Withdraw event', async () => {
        const eventLog = result.logs[0];

        assertEvent(eventLog, 'Withdraw',
          {
            _token: ETHER_ADDRESS,
            _user: user1,
            _amount: amount,
            _balance: '0'
          });
      })
    })

    describe('failure', () => {
      it('rejects withdraw bigger than balance', async () => {
        await exchange.withdrawEther(amount + 1, { from: user1 }).should.be.rejectedWith(EVM_REVERT);
      })
    })
  })

  describe('depositing tokens', () => {
    let result;
    let amount;

    describe('success', () => {
      beforeEach(async () => {
        amount = tokens(10);
        await token.approve(exchange.address, amount, { from: user1 });
        result = await exchange.depositToken(token.address, amount, { from: user1 });
      })

      it('tracks the token deposit', async () => {
        let exchangeBalance = await token.balanceOf(exchange.address);
        exchangeBalance.toString().should.equal(amount.toString());
        let userBalanceInExchange = await exchange.tokens(token.address, user1);
        userBalanceInExchange.toString().should.equal(amount.toString());
      })

      it('emits a Deposit event', async () => {
        const eventLog = result.logs[0];

        assertEvent(eventLog, 'Deposit',
          {
            _token: token.address,
            _user: user1,
            _amount: amount,
            _balance: amount
          });
      })
    })

    describe('failure', () => {
      it('rejects Ether deposits', async () => {
        result = await exchange.depositToken(ETHER_ADDRESS, tokens(10), { from: user1 }).should.be.rejectedWith(EVM_REVERT);
      })

      it('fails when no tokens are approved', async () => {
        // Don't approve any tokens before depositing
        result = await exchange.depositToken(token.address, tokens(10), { from: user1 }).should.be.rejectedWith(EVM_REVERT);
      })
    })
  })

  describe('withdrawing tokens', () => {
    let result;
    let amount;

    beforeEach(async () => {
      amount = tokens(10);
      await token.approve(exchange.address, amount, { from: user1 });
      await exchange.depositToken(token.address, amount, { from: user1 });
    })

    describe('success', () => {
      beforeEach(async () => {
        result = await exchange.withdrawToken(token.address, amount, { from: user1 });
      })

      it('withdraws tokens', async () => {
        let exchangeBalance = await token.balanceOf(exchange.address);
        exchangeBalance.toString().should.equal('0');
        let userBalanceInExchange = await exchange.tokens(token.address, user1);
        userBalanceInExchange.toString().should.equal('0');
      })

      it('emits a Withdraw event', async () => {
        const eventLog = result.logs[0];

        assertEvent(eventLog, 'Withdraw',
          {
            _token: token.address,
            _user: user1,
            _amount: amount,
            _balance: '0'
          });
      })
    })

    describe('failure', () => {
      it('rejects Ether withdrawals', async () => {
        const minimalWeiAmount = 1;
        await exchange.withdrawToken(ETHER_ADDRESS, minimalWeiAmount, { from: user1 }).should.be.rejectedWith(EVM_REVERT);
      })

      it('fails withdrawing more than balance', async () => {
        const moreThanBalance = amount + 1;
        await exchange.depositToken(token.address, moreThanBalance, { from: user1 }).should.be.rejectedWith(EVM_REVERT);
      })
    })
  })

  describe('checking balances', () => {
    let amount;

    beforeEach(async () => {
      amount = ether(1);
      await exchange.depositEther({ from: user1, value: amount })
    })

    it('returns user balance', async () => {
      const balance = await exchange.balanceOf(ETHER_ADDRESS, user1);
      balance.toString().should.equal(amount.toString());
    })
  })
})