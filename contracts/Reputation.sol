// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "./interfaces/IReputation.sol";

contract Reputation is IReputation, Initializable, OwnableUpgradeable, ReentrancyGuardUpgradeable {
    mapping(address => UserReputation) private userReputations;
    mapping(address => Rating[]) private userRatings;
    mapping(address => bool) public authorizedContracts;
    
    uint256 public constant MIN_RATING = 1;
    uint256 public constant MAX_RATING = 5;
    
    event ReputationUpdated(address indexed user, uint256 rating, string feedback, address indexed rater);
    event AuthorizedContractAdded(address indexed contractAddress);
    event AuthorizedContractRemoved(address indexed contractAddress);
    
    modifier onlyAuthorized() {
        require(authorizedContracts[msg.sender] || msg.sender == owner(), "Not authorized");
        _;
    }
    
    function initialize() public initializer {
        __Ownable_init();
        __ReentrancyGuard_init();
    }
    
    function addAuthorizedContract(address contractAddress) external onlyOwner {
        authorizedContracts[contractAddress] = true;
        emit AuthorizedContractAdded(contractAddress);
    }
    
    function removeAuthorizedContract(address contractAddress) external onlyOwner {
        authorizedContracts[contractAddress] = false;
        emit AuthorizedContractRemoved(contractAddress);
    }
    
    function updateReputation(
        address user, 
        uint256 rating, 
        string memory feedback
    ) external onlyAuthorized nonReentrant {
        require(user != address(0), "Invalid user address");
        require(rating >= MIN_RATING && rating <= MAX_RATING, "Rating out of range");
        
        UserReputation storage reputation = userReputations[user];
        
        // Add new rating
        userRatings[user].push(Rating({
            rater: msg.sender,
            score: rating,
            feedback: feedback,
            timestamp: block.timestamp
        }));
        
        // Update aggregated reputation
        reputation.totalScore += rating;
        reputation.ratingCount += 1;
        reputation.averageRating = (reputation.totalScore * 100) / reputation.ratingCount; // Multiplied by 100 for precision
        
        emit ReputationUpdated(user, rating, feedback, msg.sender);
    }
    
    function incrementCompletedShifts(address user) external onlyAuthorized {
        require(user != address(0), "Invalid user address");
        userReputations[user].completedShifts += 1;
    }
    
    function getReputation(address user) external view returns (UserReputation memory) {
        return userReputations[user];
    }
    
    function getUserRatings(address user) external view returns (Rating[] memory) {
        return userRatings[user];
    }
    
    function getRatingCount(address user) external view returns (uint256) {
        return userRatings[user].length;
    }
}