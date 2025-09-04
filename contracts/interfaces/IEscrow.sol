// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IEscrow {
    enum EscrowStatus {
        Active,
        Released,
        Refunded,
        Disputed
    }
    
    struct EscrowData {
        uint256 shiftId;
        address restaurant;
        address chef;
        uint256 amount;
        EscrowStatus status;
        uint256 createdAt;
        uint256 releaseAfter;
    }
    
    function createEscrow(uint256 shiftId, address chef, uint256 amount) external payable;
    function releaseEscrow(uint256 shiftId) external;
    function refundEscrow(uint256 shiftId) external;
    function disputeEscrow(uint256 shiftId, string memory reason) external;
    function autoRelease(uint256 shiftId) external;
    function getEscrow(uint256 shiftId) external view returns (EscrowData memory);
}