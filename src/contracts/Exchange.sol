pragma solidity ^0.5.0;

import "./Token.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";

contract Exchange {
	using SafeMath for uint256;

	// Variables
	address public feeAccount; // the account that receives exchange fees
	uint256 public feePercent; // the fee percentage
	address constant ETHER = address(0); // store Ether in tokens mapping with blank address
	mapping(address => mapping(address => uint256)) public tokens; // token address to user balance
	mapping(uint256 => _Order) public orders; // order id to order obj
	mapping(uint256 => bool) public orderCancelled;
	mapping(uint256 => bool) public orderFilled;
	uint256 public orderCount;

	// Events
	event Deposit(address _token, address _user, uint256 _amount, uint256 _balance);

	event Withdraw(address _token, address _user, uint256 _amount, uint256 _balance);

	event Order(
		uint256 _id,
		address _user,
		address _tokenGet,
		uint256 _amountGet,
		address _tokenGive,
		uint256 _amountGive,
		uint256 _timestamp
	);

	event Cancel(
		uint256 _id,
		address _user,
		address _tokenGet,
		uint256 _amountGet,
		address _tokenGive,
		uint256 _amountGive,
		uint256 _timestamp
	);

	event Trade(
		uint256 _id,
		address _user,
		address _tokenGet,
		uint256 _amountGet,
		address _tokenGive,
		uint256 _amountGive,
		address _userFill,
		uint256 _timestamp
	);

	// Structs
	struct _Order {
		uint256 _id;
		address _user;
		address _tokenGet;
		uint256 _amountGet;
		address _tokenGive;
		uint256 _amountGive;
		uint256 _timestamp;
	}

	constructor(address _feeAccount, uint256 _feePercent) public {
		feeAccount = _feeAccount;
		feePercent = _feePercent;
	}

	// Fallback: reverts if Ether is sent to this smart contract by mistake
	function() external {
		revert();
	}

	function depositEther() public payable {
		tokens[ETHER][msg.sender] = tokens[ETHER][msg.sender].add(msg.value);
		emit Deposit(ETHER, msg.sender, msg.value, tokens[ETHER][msg.sender]);
	}

	function withdrawEther(uint256 _amount) public {
		require(tokens[ETHER][msg.sender] >= _amount);
		tokens[ETHER][msg.sender] = tokens[ETHER][msg.sender].sub(_amount);

		// in newer solidity its recommended to use
		// (bool success, ) = msg.sender.call{value: _amount}("");
		// require(success, "Transfer failed.");
		msg.sender.transfer(_amount);

		emit Withdraw(ETHER, msg.sender, _amount, tokens[ETHER][msg.sender]);
	}

	function depositToken(address _token, uint256 _amount) public {
		require(_token != ETHER);
		require(Token(_token).transferFrom(msg.sender, address(this), _amount));
		tokens[_token][msg.sender] = tokens[_token][msg.sender].add(_amount);
		emit Deposit(_token, msg.sender, _amount, tokens[_token][msg.sender]);
	}

	function withdrawToken(address _token, uint256 _amount) public {
		require(_token != ETHER);
		require(tokens[_token][msg.sender] >= _amount);
		tokens[_token][msg.sender] = tokens[_token][msg.sender].sub(_amount);
		require(Token(_token).transfer(msg.sender, _amount));
		emit Withdraw(_token, msg.sender, _amount, tokens[_token][msg.sender]);
	}

	function balanceOf(address _token, address _user)
		public
		view
		returns (uint256 _balance)
	{
		return tokens[_token][_user];
	}

	function makeOrder(
		address _tokenGet,
		uint256 _amountGet,
		address _tokenGive,
		uint256 _amountGive
	) public {
		orderCount = orderCount.add(1);

		orders[orderCount] = _Order(
			orderCount,
			msg.sender,
			_tokenGet,
			_amountGet,
			_tokenGive,
			_amountGive,
			now
		);

		emit Order(
			orderCount,
			msg.sender,
			_tokenGet,
			_amountGet,
			_tokenGive,
			_amountGive,
			now
		);
	}

	function cancelOrder(uint256 _id) public {
		_Order storage order = orders[_id];
		require(address(order._user) == msg.sender);
		require(order._id == _id);

		orderCancelled[_id] = true;

		emit Cancel(
			order._id,
			msg.sender,
			order._tokenGet,
			order._amountGet,
			order._tokenGive,
			order._amountGive,
			now
		);
	}

	function fillOrder(uint256 _id) public {
		require(!orderFilled[_id]);
		require(!orderCancelled[_id]);

		_Order storage order = orders[_id];
		require(order._id == _id);

		orderFilled[order._id] = true;

		_trade(
			order._id,
			order._user,
			order._tokenGet,
			order._amountGet,
			order._tokenGive,
			order._amountGive
		);
	}

	function _trade(
		uint256 _orderId,
		address _user,
		address _tokenGet,
		uint256 _amountGet,
		address _tokenGive,
		uint256 _amountGive
	) internal {
		// Fee paid by the user that fills the order, a.k.a. msg.sender
		uint256 feeAmount = _amountGet.mul(feePercent).div(100);

		tokens[_tokenGet][msg.sender] = tokens[_tokenGet][msg.sender].sub(
			_amountGet.add(feeAmount)
		);
		tokens[_tokenGet][_user] = tokens[_tokenGet][_user].add(_amountGet);
		tokens[_tokenGet][feeAccount] = tokens[_tokenGet][feeAccount].add(feeAmount);

		tokens[_tokenGive][_user] = tokens[_tokenGive][_user].sub(_amountGive);
		tokens[_tokenGive][msg.sender] = tokens[_tokenGive][msg.sender].add(_amountGive);

		emit Trade(
			_orderId,
			_user,
			_tokenGet,
			_amountGet,
			_tokenGive,
			_amountGive,
			msg.sender,
			now
		);
	}
}
