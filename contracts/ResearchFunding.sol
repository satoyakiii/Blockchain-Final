// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract ResearchFunding {

    struct Campaign {
        string title;
        uint goal;
        uint deadline;
        uint totalContributed;
        address creator;
        bool finalized;
    }

    uint public campaignCount;

    mapping(uint => Campaign) public campaigns;
    mapping(uint => mapping(address => uint)) public contributions;

    event CampaignCreated(uint campaignId, string title, uint goal, uint deadline);
    event ContributionMade(uint campaignId, address contributor, uint amount);

    function createCampaign(string memory _title, uint _goal, uint _durationInSeconds) public {
        campaignCount++;

        campaigns[campaignCount] = Campaign({
            title: _title,
            goal: _goal,
            deadline: block.timestamp + _durationInSeconds,
            totalContributed: 0,
            creator: msg.sender,
            finalized: false
        });

        emit CampaignCreated(campaignCount, _title, _goal, block.timestamp + _durationInSeconds);
    }

    function contribute(uint _campaignId) public payable {
        Campaign storage campaign = campaigns[_campaignId];

        require(block.timestamp < campaign.deadline, "Campaign ended");
        require(msg.value > 0, "Send ETH");

        campaign.totalContributed += msg.value;
        contributions[_campaignId][msg.sender] += msg.value;

        emit ContributionMade(_campaignId, msg.sender, msg.value);
    }

    function getContribution(uint _campaignId, address _user) public view returns (uint) {
        return contributions[_campaignId][_user];
    }
}
