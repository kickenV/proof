// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IShiftManager {
    enum ShiftStatus {
        Posted,
        Applied,
        Accepted,
        Completed,
        Disputed,
        Cancelled
    }
    
    struct Shift {
        uint256 id;
        address restaurant;
        address chef;
        string detailsCID;
        uint256 payment;
        ShiftStatus status;
        uint256 createdAt;
        uint256 startTime;
        uint256 endTime;
    }
    
    function postShift(
        string memory detailsCID,
        uint256 payment,
        uint256 startTime,
        uint256 endTime
    ) external returns (uint256);
    
    function applyToShift(uint256 shiftId) external;
    function acceptApplication(uint256 shiftId, address chef) external;
    function markShiftComplete(uint256 shiftId) external;
    function confirmCompletion(uint256 shiftId) external;
    function disputeShift(uint256 shiftId, string memory reason) external;
    function cancelShift(uint256 shiftId, string memory reason) external;
    
    function getShift(uint256 shiftId) external view returns (Shift memory);
    function getShiftApplications(uint256 shiftId) external view returns (address[] memory);
}