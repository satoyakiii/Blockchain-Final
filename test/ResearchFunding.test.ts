import { expect } from "chai";
import hre from "hardhat";

describe("ResearchFunding", function () {
  it("Should create a campaign", async function () {

    const ethers = await hre.network.connect().then(n => n.ethers);

    const Contract = await ethers.getContractFactory("ResearchFunding");
    const contract = await Contract.deploy();
    await contract.waitForDeployment();

    await contract.createCampaign(
      "AI Research",
      ethers.parseEther("1"),
      3600
    );

    const campaign = await contract.campaigns(1);

    expect(campaign.title).to.equal("AI Research");
  });
});
