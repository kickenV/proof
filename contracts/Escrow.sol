// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "./interfaces/IEscrow.sol";

contract Escrow is IEscrow, Initializable, OwnableUpgradeable, ReentrancyGuardUpgradeable {
    mapping(uint256 => EscrowData) public escrows;
    address public shiftManagerContract;
    
    uint256 public constant AUTO_RELEASE_PERIOD = 7 days;
    uint256 public constant DISPUTE_PERIOD = 3 days;
    
    event EscrowCreated(uint256 indexed shiftId, address indexed restaurant, address indexed chef, uint256 amount);
    event EscrowReleased(uint256 indexed shiftId, address indexed chef, uint256 amount);
    event EscrowRefunded(uint256 indexed shiftId, address indexed restaurant, uint256 amount);
    event EscrowDisputed(uint256 indexed shiftId, string reason);
    
    modifier onlyShiftManager() {
        require(msg.sender == shiftManagerContract, "Only ShiftManager can call this");
        _;
    }
    
    modifier validEscrow(uint256 shiftId) {
        require(escrows[shiftId].shiftId != 0, "Escrow does not exist");
        _;
    }
    
    function initialize(address _shiftManager) public initializer {
        __Ownable_init();
        __ReentrancyGuard_init();
        require(_shiftManager != address(0), "Invalid ShiftManager address");
        shiftManagerContract = _shiftManager;
    }
    
    function createEscrow(
        uint256 shiftId,
        address chef,
        uint256 amount
    ) external payable onlyShiftManager nonReentrant {
        require(msg.value == amount, "Incorrect payment amount");
        require(chef != address(0), "Invalid chef address");
        require(amount > 0, "Amount must be greater than 0");
        require(escrows[shiftId].shiftId == 0, "Escrow already exists");
        
        escrows[shiftId] = EscrowData({
            shiftId: shiftId,
            restaurant: tx.origin,
            chef: chef,
            amount: amount,
            status: EscrowStatus.Active,
            createdAt: block.timestamp,
            releaseAfter: block.timestamp + AUTO_RELEASE_PERIOD
        });
        
        emit EscrowCreated(shiftId, tx.origin, chef, amount);
    }
    
    function releaseEscrow(uint256 shiftId) external onlyShiftManager validEscrow(shiftId) nonReentrant {
        EscrowData storage escrow = escrows[shiftId];
        require(escrow.status == EscrowStatus.Active, "Escrow not active");
        
        escrow.status = EscrowStatus.Released;
        
        (bool success, ) = escrow.chef.call{value: escrow.amount}("");
        require(success, "Payment transfer failed");
        
        emit EscrowReleased(shiftId, escrow.chef, escrow.amount);
    }
    
    function refundEscrow(uint256 shiftId) external onlyShiftManager validEscrow(shiftId) nonReentrant {
        EscrowData storage escrow = escrows[shiftId];
        require(escrow.status == EscrowStatus.Active, "Escrow not active");
        
        escrow.status = EscrowStatus.Refunded;
        
        (bool success, ) = escrow.restaurant.call{value: escrow.amount}("");
        require(success, "Refund transfer failed");
        
        emit EscrowRefunded(shiftId, escrow.restaurant, escrow.amount);
    }
    
    function disputeEscrow(uint256 shiftId, string memory reason) external validEscrow(shiftId) {
        EscrowData storage escrow = escrows[shiftId];
        require(escrow.status == EscrowStatus.Active, "Escrow not active");
        require(
            msg.sender == escrow.restaurant || msg.sender == escrow.chef, 
            "Only restaurant or chef can dispute"
        );
        
        escrow.status = EscrowStatus.Disputed;
        emit EscrowDisputed(shiftId, reason);
    }
    
    function autoRelease(uint256 shiftId) external validEscrow(shiftId) nonReentrant {
        EscrowData storage escrow = escrows[shiftId];
        require(escrow.status == EscrowStatus.Active, "Escrow not active");
        require(block.timestamp >= escrow.releaseAfter, "Auto-release period not reached");
        
        escrow.status = EscrowStatus.Released;
        
        (bool success, ) = escrow.chef.call{value: escrow.amount}("");
        require(success, "Payment transfer failed");
        
        emit EscrowReleased(shiftId, escrow.chef, escrow.amount);
    }
    
    function getEscrow(uint256 shiftId) external view validEscrow(shiftId) returns (EscrowData memory) {
        return escrows[shiftId];
    }
    
    function updateShiftManager(address newShiftManager) external onlyOwner {
        require(newShiftManager != address(0), "Invalid address");
        shiftManagerContract = newShiftManager;
    }
    
    // Emergency functions
    function emergencyWithdraw(uint256 shiftId) external onlyOwner validEscrow(shiftId) {
        EscrowData storage escrow = escrows[shiftId];
        require(escrow.status == EscrowStatus.Disputed, "Only disputed escrows can be emergency withdrawn");
        require(block.timestamp >= escrow.createdAt + DISPUTE_PERIOD, "Dispute period not over");
        
        escrow.status = EscrowStatus.Refunded;
        
        (bool success, ) = escrow.restaurant.call{value: escrow.amount}("");
        require(success, "Emergency withdrawal failed");
    }
}