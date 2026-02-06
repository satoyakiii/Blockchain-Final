import hre from "hardhat";

async function main() {
  const ethers = await hre.network.connect().then(n => n.ethers);

  const Contract = await ethers.getContractFactory("ResearchFunding");
  const contract = await Contract.deploy();

  await contract.waitForDeployment();

  console.log("Contract deployed to:", await contract.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
