import { expect } from "chai";

describe("ResearchFunding", function () {

  async function deployContract() {
    const hre = await import("hardhat");
    const ethers = await hre.network.connect().then(n => n.ethers);

    const Contract = await ethers.getContractFactory("ResearchFunding");
    const contract = await Contract.deploy();
    await contract.waitForDeployment();

    const [owner, user] = await ethers.getSigners();

    return { contract, owner, user, ethers };
  }

  it("Should create a campaign", async function () {
    const { contract, ethers } = await deployContract();

    await contract.createCampaign(
      "AI Research",
      ethers.parseEther("1"),
      3600
    );

    const campaign = await contract.campaigns(1);

    expect(campaign.title).to.equal("AI Research");
  });

  it("Should accept contributions", async function () {
    const { contract, ethers } = await deployContract();

    await contract.createCampaign(
      "AI Research",
      ethers.parseEther("1"),
      3600
    );

    await contract.contribute(1, {
      value: ethers.parseEther("0.5"),
    });

    const campaign = await contract.campaigns(1);

    // читаем totalRaised безопасно
    const raised = campaign.totalRaised ?? campaign[3];

    expect(raised).to.equal(
      ethers.parseEther("0.5")
    );
  });

  it("Should store contributor amount", async function () {
    const { contract, ethers, user } = await deployContract();

    await contract.createCampaign(
      "AI Research",
      ethers.parseEther("1"),
      3600
    );

    await contract.connect(user).contribute(1, {
      value: ethers.parseEther("0.3"),
    });

    const contribution = await contract.contributions(
      1,
      user.address
    );

    expect(contribution).to.equal(
      ethers.parseEther("0.3")
    );
  });

  it("Should reject zero contribution", async function () {
    const { contract } = await deployContract();

    await contract.createCampaign(
      "AI Research",
      1000,
      3600
    );

    await expect(
      contract.contribute(1, { value: 0 })
    ).to.be.rejected;
  });

});
