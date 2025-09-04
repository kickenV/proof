// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "./interfaces/IEscrow.sol";
import "./interfaces/IReputation.sol";
import "./interfaces/IShiftManager.sol";

contract ShiftManager is IShiftManager, Initializable, OwnableUpgradeable, ReentrancyGuardUpgradeable {
    mapping(uint256 => Shift) public shifts;
    mapping(uint256 => address[]) public shiftApplications;
    mapping(address => uint256[]) public restaurantShifts;
    mapping(address => uint256[]) public chefApplications;
    mapping(address => uint256[]) public chefAcceptedShifts;
    
    uint256 public nextShiftId;
    IEscrow public escrowContract;
    IReputation public reputationContract;
    
    uint256 public constant APPLICATION_PERIOD = 1 hours;
    uint256 public constant COMPLETION_TIMEOUT = 2 hours;
    uint256 public constant MIN_PAYMENT = 0.01 ether;
    
    event ShiftPosted(
        uint256 indexed shiftId, 
        address indexed restaurant, 
        string detailsCID, 
        uint256 payment,
        uint256 startTime,
        uint256 endTime
    );
    
    event ShiftApplied(uint256 indexed shiftId, address indexed chef);
    event ShiftAccepted(uint256 indexed shiftId, address indexed chef);
    event ShiftCompleted(uint256 indexed shiftId, address indexed chef);
    event ShiftDisputed(uint256 indexed shiftId, string reason);
    event ShiftCancelled(uint256 indexed shiftId, string reason);
    
    modifier onlyRestaurant(uint256 shiftId) {
        require(shifts[shiftId].restaurant == msg.sender, "Only restaurant can perform this action");
        _;
    }
    
    modifier onlyAcceptedChef(uint256 shiftId) {
        require(shifts[shiftId].chef == msg.sender, "Only accepted chef can perform this action");
        _;
    }
    
    modifier validShift(uint256 shiftId) {
        require(shiftId < nextShiftId && shiftId > 0, "Invalid shift ID");
        _;
    }
    
    function initialize(address _escrow, address _reputation) public initializer {
        __Ownable_init();
        __ReentrancyGuard_init();
        require(_escrow != address(0), "Invalid escrow address");
        require(_reputation != address(0), "Invalid reputation address");
        escrowContract = IEscrow(_escrow);
        reputationContract = IReputation(_reputation);
        nextShiftId = 1;
    }
    
    function postShift(
        string memory detailsCID,
        uint256 payment,
        uint256 startTime,
        uint256 endTime
    ) external nonReentrant returns (uint256) {
        require(bytes(detailsCID).length > 0, "Details CID required");
        require(payment >= MIN_PAYMENT, "Payment too low");
        require(startTime > block.timestamp, "Start time must be in future");
        require(endTime > startTime, "End time must be after start time");
        require(endTime - startTime <= 12 hours, "Shift too long");
        
        uint256 shiftId = nextShiftId++;
        
        shifts[shiftId] = Shift({
            id: shiftId,
            restaurant: msg.sender,
            chef: address(0),
            detailsCID: detailsCID,
            payment: payment,
            status: ShiftStatus.Posted,
            createdAt: block.timestamp,
            startTime: startTime,
            endTime: endTime
        });
        
        restaurantShifts[msg.sender].push(shiftId);
        
        emit ShiftPosted(shiftId, msg.sender, detailsCID, payment, startTime, endTime);
        return shiftId;
    }
    
    function applyToShift(uint256 shiftId) external validShift(shiftId) {
        Shift storage shift = shifts[shiftId];
        require(shift.status == ShiftStatus.Posted || shift.status == ShiftStatus.Applied, "Shift not accepting applications");
        require(msg.sender != shift.restaurant, "Restaurant cannot apply to own shift");
        require(block.timestamp < shift.startTime - APPLICATION_PERIOD, "Application period closed");
        
        // Check if chef already applied
        address[] storage applications = shiftApplications[shiftId];
        for (uint i = 0; i < applications.length; i++) {
            require(applications[i] != msg.sender, "Already applied to this shift");
        }
        
        applications.push(msg.sender);
        chefApplications[msg.sender].push(shiftId);
        
        if (shift.status == ShiftStatus.Posted) {
            shifts[shiftId].status = ShiftStatus.Applied;
        }
        
        emit ShiftApplied(shiftId, msg.sender);
    }
    
    function acceptApplication(uint256 shiftId, address chef) 
        external 
        payable
        validShift(shiftId) 
        onlyRestaurant(shiftId) 
        nonReentrant 
    {
        Shift storage shift = shifts[shiftId];
        require(shift.status == ShiftStatus.Applied, "No applications to accept");
        require(chef != address(0), "Invalid chef address");
        require(msg.value == shift.payment, "Incorrect payment amount");
        
        // Verify chef applied
        address[] storage applications = shiftApplications[shiftId];
        bool hasApplied = false;
        for (uint i = 0; i < applications.length; i++) {
            if (applications[i] == chef) {
                hasApplied = true;
                break;
            }
        }
        require(hasApplied, "Chef has not applied to this shift");
        
        shift.chef = chef;
        shift.status = ShiftStatus.Accepted;
        chefAcceptedShifts[chef].push(shiftId);
        
        // Create escrow
        escrowContract.createEscrow{value: shift.payment}(shiftId, chef, shift.payment);
        
        emit ShiftAccepted(shiftId, chef);
    }
    
    function markShiftComplete(uint256 shiftId) 
        external 
        validShift(shiftId) 
        onlyAcceptedChef(shiftId) 
    {
        Shift storage shift = shifts[shiftId];
        require(shift.status == ShiftStatus.Accepted, "Shift not in accepted state");
        require(block.timestamp >= shift.endTime, "Shift not yet ended");
        
        shift.status = ShiftStatus.Completed;
        
        emit ShiftCompleted(shiftId, msg.sender);
    }
    
    function confirmCompletion(uint256 shiftId) 
        external 
        validShift(shiftId) 
        onlyRestaurant(shiftId) 
        nonReentrant 
    {
        Shift storage shift = shifts[shiftId];
        require(shift.status == ShiftStatus.Completed, "Shift not marked as completed");
        
        // Release escrow
        escrowContract.releaseEscrow(shiftId);
        
        // Update reputation and completed shifts
        reputationContract.updateReputation(shift.chef, 5, "Shift completed successfully");
        reputationContract.updateReputation(shift.restaurant, 5, "Payment released on time");
        reputationContract.incrementCompletedShifts(shift.chef);
        reputationContract.incrementCompletedShifts(shift.restaurant);
    }
    
    function disputeShift(uint256 shiftId, string memory reason) 
        external 
        validShift(shiftId)
    {
        Shift storage shift = shifts[shiftId];
        require(
            msg.sender == shift.restaurant || msg.sender == shift.chef,
            "Only restaurant or chef can dispute"
        );
        require(
            shift.status == ShiftStatus.Accepted || shift.status == ShiftStatus.Completed,
            "Cannot dispute this shift"
        );
        
        shift.status = ShiftStatus.Disputed;
        
        // Also dispute the escrow
        escrowContract.disputeEscrow(shiftId, reason);
        
        emit ShiftDisputed(shiftId, reason);
    }
    
    function cancelShift(uint256 shiftId, string memory reason) 
        external 
        validShift(shiftId) 
        onlyRestaurant(shiftId)
        nonReentrant
    {
        Shift storage shift = shifts[shiftId];
        require(
            shift.status == ShiftStatus.Posted || shift.status == ShiftStatus.Applied,
            "Cannot cancel accepted shift"
        );
        
        shift.status = ShiftStatus.Cancelled;
        
        emit ShiftCancelled(shiftId, reason);
    }
    
    // View functions
    function getShift(uint256 shiftId) external view validShift(shiftId) returns (Shift memory) {
        return shifts[shiftId];
    }
    
    function getShiftApplications(uint256 shiftId) external view validShift(shiftId) returns (address[] memory) {
        return shiftApplications[shiftId];
    }
    
    function getRestaurantShifts(address restaurant) external view returns (uint256[] memory) {
        return restaurantShifts[restaurant];
    }
    
    function getChefApplications(address chef) external view returns (uint256[] memory) {
        return chefApplications[chef];
    }
    
    function getChefAcceptedShifts(address chef) external view returns (uint256[] memory) {
        return chefAcceptedShifts[chef];
    }
    
    function getActiveShifts() external view returns (uint256[] memory activeShifts) {
        uint256 count = 0;
        
        // First pass: count active shifts
        for (uint256 i = 1; i < nextShiftId; i++) {
            if (shifts[i].status == ShiftStatus.Posted || shifts[i].status == ShiftStatus.Applied) {
                count++;
            }
        }
        
        // Second pass: populate array
        activeShifts = new uint256[](count);
        uint256 index = 0;
        for (uint256 i = 1; i < nextShiftId; i++) {
            if (shifts[i].status == ShiftStatus.Posted || shifts[i].status == ShiftStatus.Applied) {
                activeShifts[index] = i;
                index++;
            }
        }
    }
    
    // Admin functions
    function updateEscrowContract(address newEscrow) external onlyOwner {
        require(newEscrow != address(0), "Invalid address");
        escrowContract = IEscrow(newEscrow);
    }
    
    function updateReputationContract(address newReputation) external onlyOwner {
        require(newReputation != address(0), "Invalid address");
        reputationContract = IReputation(newReputation);
    }
}