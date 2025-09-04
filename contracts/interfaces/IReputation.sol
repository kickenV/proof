// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IReputation {
    struct Rating {
        address rater;
        uint256 score;
        string feedback;
        uint256 timestamp;
    }
    
    struct UserReputation {
        uint256 totalScore;
        uint256 ratingCount;
        uint256 averageRating;
        uint256 completedShifts;
    }
    
    function updateReputation(address user, uint256 rating, string memory feedback) external;
    function getReputation(address user) external view returns (UserReputation memory);
    function getUserRatings(address user) external view returns (Rating[] memory);
    function incrementCompletedShifts(address user) external;
}