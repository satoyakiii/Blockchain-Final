const hre = require("hardhat");

async function main() {

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  // Deploy Token
  const Token = await hre.ethers.getContractFactory("ResearchToken");
  const token = await Token.deploy();
  await token.waitForDeployment();

  const tokenAddress = await token.getAddress();
  console.log("Token deployed to:", tokenAddress);

  // Deploy Funding
  const Funding = await hre.ethers.getContractFactory("ResearchFunding");
  const funding = await Funding.deploy(tokenAddress);
  await funding.waitForDeployment();

  const fundingAddress = await funding.getAddress();
  console.log("Funding deployed to:", fundingAddress);

  // Connect token to funding
  await token.setFundingContract(fundingAddress);

  console.log("Funding contract set in token");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
