const { tokens, ether, EVM_REVERT, ETHER_ADDRESS, assertEvent, assertEquals } = require('./helpers');
const Token = artifacts.require("Token");
const Exchange = artifacts.require("Exchange");

require('chai').use(require('chai-as-promised')).should()

contract('Exchange', ([deployer, feeAccount, user1, user2]) => {
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

  describe('making orders', () => {
    let amount;
    let result;

    beforeEach(async () => {
      amount = ether(1);
      result = await exchange.makeOrder(token.address, 1, ETHER_ADDRESS, 1, { from: user1 })
    })

    it('tracks the newly created order', async () => {
      const orderCount = await exchange.orderCount();
      assertEquals(orderCount, 1, 'orderCount');

      const order = await exchange.orders(1);
      assertEquals(order._id, 1, 'ID');
      assertEquals(order._user, user1, 'User');
      assertEquals(order._tokenGet, token.address, 'tokenGet');
      assertEquals(order._amountGet, 1, 'amountGet');
      assertEquals(order._tokenGive, ETHER_ADDRESS, 'tokenGive');
      assertEquals(order._amountGive, 1, 'amountGive');
      order._timestamp.toString().length.should.be.at.least(1, 'timestamp is not present');
    })

    it('emits an Order event', async () => {
      const eventLog = result.logs[0];

      assertEvent(eventLog, 'Order',
        {
          _id: 1,
          _user: user1,
          _tokenGet: token.address,
          _amountGet: 1,
          _tokenGive: ETHER_ADDRESS,
          _amountGive: 1
        });

      const eventTimeStamp = eventLog.args._timestamp;
      eventTimeStamp.toString().length.should.be.at.least(1, 'timestamp is not present');
    })
  })

  describe('other actions', () => {
    let amount;
    let orderId;

    beforeEach(async () => {
      amount = ether(1);
      orderId = 1;
      await exchange.depositEther({ from: user1, value: amount });
      await exchange.makeOrder(token.address, 1, ETHER_ADDRESS, 1, { from: user1 });
    })

    describe('canceling orders', () => {
      let result;

      describe('success', () => {
        beforeEach(async () => {
          result = await exchange.cancelOrder(orderId, { from: user1 });
        })

        it('cancels an order', async () => {
          const orderCancelled = await exchange.orderCancelled(1);
          assertEquals(orderCancelled, true, 'orderCancelled');
        })

        it('emits a Cancel event', async () => {
          const eventLog = result.logs[0];

          assertEvent(eventLog, 'Cancel',
            {
              _id: orderId,
              _user: user1,
              _tokenGet: token.address,
              _amountGet: 1,
              _tokenGive: ETHER_ADDRESS,
              _amountGive: 1
            });

          const eventTimeStamp = eventLog.args._timestamp;
          eventTimeStamp.toString().length.should.be.at.least(1, 'timestamp is not present');
        })
      })

      describe('failure', () => {
        it('rejects invalid order ids', async () => {
          const invalidOrderId = 2;
          await exchange.cancelOrder(invalidOrderId, { from: user1 }).should.be.rejectedWith(EVM_REVERT);
        })
        it('rejects wrong user', async () => {
          const wrongUser = deployer;
          await exchange.cancelOrder(orderId, { from: wrongUser }).should.be.rejectedWith(EVM_REVERT);
        })
      })
    })
  })

  describe('order actions', () => {
    beforeEach(async () => {
      // User1 deposits ether only
      await exchange.depositEther({ from: user1, value: ether(1) });
      // Give tokens to user2
      await token.transfer(user2, tokens(100), { from: deployer });
      // User2 deposits tokens only
      await token.approve(exchange.address, tokens(2), { from: user2 });
      await exchange.depositToken(token.address, tokens(2), { from: user2 });
      // User1 makes an order to buy tokens with Ether
      await exchange.makeOrder(token.address, tokens(1), ETHER_ADDRESS, ether(1), { from: user1 });
    })

    describe('filling orders', () => {
      let result;
      let orderId = 1;

      describe('success', () => {
        beforeEach(async () => {
          // User2 fills order
          result = await exchange.fillOrder(orderId, { from: user2 });
        })

        it('executes the trade and charges fees', async () => {
          // User1 received tokens
          assertEquals(await exchange.balanceOf(token.address, user1), tokens(1));
          // User2 received Ether
          assertEquals(await exchange.balanceOf(ETHER_ADDRESS, user2), ether(1));
          // User1 Ether deducted
          assertEquals(await exchange.balanceOf(ETHER_ADDRESS, user1), 0);
          // user2 tokens deducted with fee applied (2 - (1+10%fee))
          assertEquals(await exchange.balanceOf(token.address, user2), tokens(0.9));

          const feeAccount = await exchange.feeAccount();
          // Fee acount received fee
          assertEquals(await exchange.balanceOf(token.address, feeAccount), tokens(0.1));
        })

        it('updates order filled', async () => {
          // User1 received tokens
          assertEquals(await exchange.orderFilled(1), true);
        })

        it('emits a Trade event', async () => {
          const eventLog = result.logs[0];

          assertEvent(eventLog, 'Trade',
            {
              _id: orderId,
              _user: user1,
              _tokenGet: token.address,
              _amountGet: tokens(1),
              _tokenGive: ETHER_ADDRESS,
              _amountGive: ether(1),
              _userFill: user2
            });

          const eventTimeStamp = eventLog.args._timestamp;
          eventTimeStamp.toString().length.should.be.at.least(1, 'timestamp is not present');
        })
      })
    })
  })
})