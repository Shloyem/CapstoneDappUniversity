// Contracts
const Token = artifacts.require("Token");
const Exchange = artifacts.require("Exchange");

// Utils
const ETHER_ADDRESS = '0x0000000000000000000000000000000000000000';

const ether = (n) => {
  return new web3.utils.BN(
    web3.utils.toWei(n.toString(), 'ether')
  )
}

const tokens = (n) => ether(n)

const wait = (seconds) => {
  const milliseconds = seconds * 1000;
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

// Script
module.exports = async function (callback) {
  try {
    console.log('Script running...');
    // Fetch accounts from wallet - these are unlocked
    const accounts = await web3.eth.getAccounts();

    // Fetch the deployed token
    const token = await Token.deployed();
    console.log('Token fetched', token.address);

    // Fetch the deployed exchange
    const feeAccount = accounts[2];
    const feePercent = 10;
    const exchange = await Exchange.deployed(feeAccount, feePercent);
    console.log('Exchange fetched', exchange.address);

    // Give tokens to account [1]
    const sender = accounts[0];
    const receiver = accounts[1];
    let amount = web3.utils.toWei('10000', 'ether'); // 10,000

    await token.transfer(receiver, amount, { from: sender });
    console.log(`Transferred ${amount} tokens from ${sender} to ${receiver}`);

    // Set up exchange users
    const user1 = accounts[0];
    const user2 = accounts[1];

    // User 1 deposits 1 Ether
    amount = 1;
    await exchange.depositEther({ value: ether(amount), from: user1 });
    console.log(`Deposited ${amount} Ether from ${user1}`);

    // User 2 approves 10,000 tokens
    amount = 10000;
    await token.approve(exchange.address, tokens(amount), { from: user2 });
    console.log(`Approved ${amount} tokens from ${user2}`);

    // User 2 deposits 10,000 tokens
    await exchange.depositToken(token.address, tokens(amount), { from: user2 });
    console.log(`Deposited ${amount} tokens from ${user2}`);

    /////////////////////////////////////////////////////
    //////////////// Send a cancel order ////////////////
    /////////////////////////////////////////////////////
    let result;
    let orderId;

    // User 1 makes an order
    result = await exchange.makeOrder(token.address, tokens(100), ETHER_ADDRESS, ether(0.1), { from: user1 })
    // TODO fix empty logs
    // console.log('result: ', result);
    // console.log('logs: ', result.logs);
    // console.log('logs[0]: ', logs[0]);
    orderId = result.logs[0].args._id;
    console.log(`Made order id ${orderId} from ${user1}`);

    // User 1 cancels his order
    result = await exchange.cancelOrder(orderId, { from: user1 });
    console.log(`Cancelled order id ${orderId} from ${user1}`);

    ////////////////////////////////////////////////////
    //////////////// Seed filled orders ////////////////
    ////////////////////////////////////////////////////
    // User 1 makes an order
    result = await exchange.makeOrder(token.address, tokens(100), ETHER_ADDRESS, ether(0.1), { from: user1 })
    orderId = result.logs[0].args._id;
    console.log(`Made order id ${orderId} from ${user1}`);

    // User 2 fills order
    result = await exchange.fillOrder(orderId, { from: user2 });
    console.log(`Filled order id ${orderId} from ${user1}`);

    // Wait 1 second to prevent timestamp collision
    await wait(1);

    // User 1 makes another order
    result = await exchange.makeOrder(token.address, tokens(50), ETHER_ADDRESS, ether(0.01), { from: user1 })
    orderId = result.logs[0].args._id;
    console.log(`Made another order id ${orderId} from ${user1}`);

    // User 2 fills another order
    result = await exchange.fillOrder(orderId, { from: user2 });
    console.log(`Filled another order id ${orderId} from ${user1}`);

    // Wait 1 second
    await wait(1);

    // User 1 makes final order
    result = await exchange.makeOrder(token.address, tokens(200), ETHER_ADDRESS, ether(0.15), { from: user1 })
    orderId = result.logs[0].args._id;
    console.log(`Made another order id ${orderId} from ${user1}`);

    // User 2 fills final order
    result = await exchange.fillOrder(orderId, { from: user2 });
    console.log(`Filled another order id ${orderId} from ${user1}`);

    // Wait 1 second
    await wait(1);

    ////////////////////////////////////////////////////
    ///////////////// Seed open orders /////////////////
    ////////////////////////////////////////////////////
    // User 1 makes 10 orders
    for (let i = 0; i < 10; i++) {
      result = await exchange.makeOrder(token.address, tokens(10 * i), ETHER_ADDRESS, ether(0.01), { from: user1 })
      orderId = result.logs[0].args._id;
      console.log(`Made order id ${orderId} from ${user1}`);
      await wait(1);
    }

    // User 2 makes 10 orders
    for (let i = 0; i < 10; i++) {
      result = await exchange.makeOrder(ETHER_ADDRESS, ether(0.01), token.address, tokens(10 * i), { from: user2 })
      orderId = result.logs[0].args._id;
      console.log(`Made order id ${orderId} from ${user2}`);
      await wait(1);
    }

  } catch (error) {
    console.log(error);
  }

  callback()
}