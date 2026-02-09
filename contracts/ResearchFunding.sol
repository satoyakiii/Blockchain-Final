// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./ResearchToken.sol";

contract ResearchFunding {

    enum Status { Active, Successful, Failed }

    struct Project {
        uint id;
        string title;
        uint goal;
        uint deadline;
        uint totalRaised;
        address creator;
        Status status;
        bool fundsWithdrawn;
    }

    uint public projectCount;

    mapping(uint => Project) public projects;
    mapping(uint => mapping(address => uint)) public contributions;

    ResearchToken public token;

    constructor(address _tokenAddress) {
        token = ResearchToken(_tokenAddress);
    }

    event ProjectCreated(uint id, string title, uint goal, uint deadline);
    event ContributionMade(uint id, address contributor, uint amount);
    event ProjectFinalized(uint id, Status status);

    function createProject(
        string memory _title,
        uint _goal,
        uint _duration
    ) public {

        require(_goal > 0, "Goal must be greater than 0");
        require(_duration > 0, "Duration must be greater than 0");

        projectCount++;

        projects[projectCount] = Project({
            id: projectCount,
            title: _title,
            goal: _goal,
            deadline: block.timestamp + _duration,
            totalRaised: 0,
            creator: msg.sender,
            status: Status.Active,
            fundsWithdrawn: false
        });

        emit ProjectCreated(projectCount, _title, _goal, block.timestamp + _duration);
    }

    function contribute(uint _id) public payable {

        Project storage p = projects[_id];

        require(p.id != 0, "Project not found");
        require(p.status == Status.Active, "Project not active");
        require(block.timestamp < p.deadline, "Deadline passed");
        require(msg.value > 0, "Send some ETH");

        p.totalRaised += msg.value;
        contributions[_id][msg.sender] += msg.value;

        uint reward = msg.value * 100;
        token.mint(msg.sender, reward);

        emit ContributionMade(_id, msg.sender, msg.value);
    }

    function finalizeProject(uint _id) public {

        Project storage p = projects[_id];

        require(p.id != 0, "Project not found");
        require(block.timestamp >= p.deadline, "Too early");
        require(p.status == Status.Active, "Already finalized");

        if (p.totalRaised >= p.goal) {
            p.status = Status.Successful;
        } else {
            p.status = Status.Failed;
        }

        emit ProjectFinalized(_id, p.status);
    }

    function withdraw(uint _id) public {

        Project storage p = projects[_id];

        require(p.status == Status.Successful, "Not successful");
        require(msg.sender == p.creator, "Not creator");
        require(!p.fundsWithdrawn, "Already withdrawn");

        p.fundsWithdrawn = true;

        payable(p.creator).transfer(p.totalRaised);
    }

    function refund(uint _id) public {

        Project storage p = projects[_id];

        require(p.status == Status.Failed, "Not failed");

        uint amount = contributions[_id][msg.sender];
        require(amount > 0, "No contribution");

        contributions[_id][msg.sender] = 0;

        payable(msg.sender).transfer(amount);
    }
}
