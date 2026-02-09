

const FUNDING_ADDRESS = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
const TOKEN_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const CHAIN_ID = 31337; 

const FUNDING_ABI = [
    "function projectCount() view returns (uint)",
    "function projects(uint) view returns (uint id, string title, uint goal, uint deadline, uint totalRaised, address creator, uint8 status, bool fundsWithdrawn)",
    "function createProject(string title, uint goal, uint duration)",
    "function contribute(uint id) payable",
    "function finalizeProject(uint id)",
    "function withdraw(uint id)",
    "function refund(uint id)",
    "function contributions(uint256,address) view returns (uint256)"
];

const TOKEN_ABI = [
    "function balanceOf(address) view returns (uint)"
];

let provider, signer, fundingContract, tokenContract, userAddress;


function ensureEthers() {
    return new Promise((resolve, reject) => {
        if (window.ethers) return resolve();
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/ethers@5.7.2/dist/ethers.umd.min.js';
        s.onload = () => {
            console.log('ethers loaded from fallback CDN');
            return resolve();
        };
        s.onerror = () => {
            reject(new Error('Failed to load ethers library from CDN'));
        };
        document.head.appendChild(s);
        //safety timeout
        setTimeout(() => {
            if (window.ethers) resolve();
            else reject(new Error('ethers still not available after timeout'));
        }, 5000);
    });
}

//Connect Wallet
async function connectWallet() {
    try {
        await ensureEthers();
    } catch (err) {
        console.error(err);
        alert('Не удалось загрузить ethers.js. Проверьте подключение к интернету или используйте другой CDN.');
        return;
    }

    if (!window.ethereum) {
        alert('Установите MetaMask и запустите локальную ноду Hardhat (npx hardhat node).');
        return;
    }

    try {
        await window.ethereum.request({ method: 'eth_requestAccounts' });
        
        provider = new ethers.providers.Web3Provider(window.ethereum, "any");
        signer = provider.getSigner();
        userAddress = await signer.getAddress();

        const network = await provider.getNetwork();
        console.log("Connected to network:", network.chainId);
        if (network.chainId !== CHAIN_ID) {
            try {
                await window.ethereum.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: ethers.utils.hexValue(CHAIN_ID) }]
                });
                provider = new ethers.providers.Web3Provider(window.ethereum, "any");
                signer = provider.getSigner();
                userAddress = await signer.getAddress();
            } catch (switchErr) {
                console.warn('Switch error', switchErr);
                if (switchErr.code === 4902) {
                    try {
                        await window.ethereum.request({
                            method: 'wallet_addEthereumChain',
                            params: [{
                                chainId: ethers.utils.hexValue(CHAIN_ID),
                                chainName: 'Hardhat Local',
                                rpcUrls: ['http://127.0.0.1:8545'],
                                nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
                                blockExplorerUrls: []
                            }]
                        });
                        provider = new ethers.providers.Web3Provider(window.ethereum, "any");
                        signer = provider.getSigner();
                        userAddress = await signer.getAddress();
                    } catch (addErr) {
                        console.error('Add chain failed', addErr);
                        alert('MetaMask не смог автоматически добавить локальную сеть. Откройте MetaMask и добавьте RPC http://127.0.0.1:8545 (chainId 31337) вручную.');
                        
                    }
                } else {
                    alert('Пожалуйста, переключите MetaMask на локальную ноду (localhost:8545).');
                }
            }
        }

        //init контракты
        fundingContract = new ethers.Contract(FUNDING_ADDRESS, FUNDING_ABI, signer);
        tokenContract = new ethers.Contract(TOKEN_ADDRESS, TOKEN_ABI, signer);

        document.getElementById('connectBtn').textContent =
            userAddress.slice(0, 6) + '...' + userAddress.slice(-4);

        //слушатели для обновления состояния при смене аккаунта
        if (window.ethereum && window.ethereum.on) {
            window.ethereum.on('accountsChanged', (accounts) => {
                if (accounts.length === 0) {
                    userAddress = null;
                    document.getElementById('connectBtn').textContent = 'Connect Wallet';
                    loadProjects(); //mock
                } else {
                    userAddress = accounts[0];
                    document.getElementById('connectBtn').textContent =
                        userAddress.slice(0, 6) + '...' + userAddress.slice(-4);
                    updateBalances();
                    loadProjects();
                }
            });
            window.ethereum.on('chainChanged', (chainIdHex) => {
                console.log('chainChanged', chainIdHex);
                setTimeout(() => window.location.reload(), 200);
            });
        }

        loadProjects();
        updateBalances();

    } catch (error) {
        console.error("Connection error:", error);
        const message = error && error.message ? error.message : String(error);
        alert('Connection failed: ' + message);
    }
}

//Update Balances
async function updateBalances() {
    if (!userAddress || !provider) return;

    try {
        const ethBalance = await provider.getBalance(userAddress);
        let tokenBalance = '0';
        try {
            tokenBalance = await tokenContract.balanceOf(userAddress);
        } catch(e) {
            tokenBalance = ethers.BigNumber.from(0);
        }

        document.getElementById('ethBalance').textContent =
            parseFloat(ethers.utils.formatEther(ethBalance)).toFixed(4) + ' ETH';
        document.getElementById('tokenBalance').textContent =
            ethers.utils.formatEther(tokenBalance) + ' RST';
    } catch (error) {
        console.error("Balance error:", error);
    }
}
const HIDDEN_KEY = 'hidden_projects';

function getHiddenIds() {
  try { return JSON.parse(localStorage.getItem(HIDDEN_KEY) || '[]'); }
  catch { return []; }
}

function hideProjectLocal(id) {
  const ids = getHiddenIds();
  if (!ids.includes(id)) {
    ids.push(id);
    localStorage.setItem(HIDDEN_KEY, JSON.stringify(ids));
  }
  loadProjects();
}

function unhideAllLocal() {
  localStorage.removeItem(HIDDEN_KEY);
  loadProjects();
}

async function loadProjects() {
    const container = document.getElementById('projectsList');

    if (!fundingContract) {
        loadMockProjects();
        return;
    }

    try {
        const countBN = await fundingContract.projectCount();
        const count = countBN.toNumber();
        container.innerHTML = '';

        if (count === 0) {
            container.innerHTML = '<p style="text-align:center;">No projects yet</p>';
            return;
        }

        const now = Math.floor(Date.now() / 1000);
        const hiddenIds = getHiddenIds();

        for (let i = 1; i <= count; i++) {

            if (hiddenIds.includes(i)) continue;

            const project = await fundingContract.projects(i);

            const id = project.id.toNumber();
            const title = project.title;
            const goalBN = project.goal;
            const raisedBN = project.totalRaised;
            const deadline = project.deadline.toNumber();
            const creator = project.creator.toLowerCase();
            const fundsWithdrawn = project.fundsWithdrawn;

            const goal = ethers.utils.formatEther(goalBN);
            const raised = ethers.utils.formatEther(raisedBN);

            let status;

            //status
            if (project.status === 1) {
                status = "Successful";
            } 
            else if (project.status === 2) {
                status = "Failed";
            } 
            else {
                if (now >= deadline) {
                    status = raisedBN.gte(goalBN)
                        ? "Successful"
                        : "Failed";
                } else {
                    status = "Active";
                }
            }

            const percent =
                (parseFloat(raised) / Math.max(parseFloat(goal), 0.0000001)) * 100;

            let userContribution = ethers.BigNumber.from(0);
            if (userAddress) {
                try {
                    userContribution = await fundingContract.contributions(id, userAddress);
                } catch {}
            }

            let actionsHTML = "";

            // active
            if (status === "Active") {
                actionsHTML += `<button onclick="contribute(${id})">Contribute</button>`;
            }

            // finalize
            if (project.status === 0 && now >= deadline) {
                actionsHTML += `<button onclick="finalizeProject(${id})">Finalize</button>`;
            }

            // withdraw
            if (
                status === "Successful" &&
                creator === userAddress?.toLowerCase() &&
                !fundsWithdrawn
            ) {
                actionsHTML += `<button onclick="withdraw(${id})">Withdraw</button>`;
            }

            // refund
            if (status === "Failed" && userContribution.gt(0)) {
                actionsHTML += `<button onclick="refund(${id})">Refund</button>`;
            }

            // hide
            actionsHTML += `<button onclick="hideProjectLocal(${id})">Hide</button>`;

            const card = document.createElement("div");
            card.className = "card";

            card.innerHTML = `
                <h4>${title} [${status}]</h4>
                <div class="stats">
                    <div class="stat">
                        <span>Goal:</span>
                        <span>${goal} ETH</span>
                    </div>
                    <div class="stat">
                        <span>Raised:</span>
                        <span>${raised} ETH</span>
                    </div>
                </div>
                <div class="progress">
                    <div class="progress-bar" style="width: ${Math.min(percent, 100)}%"></div>
                </div>
                <div class="actions">
                    ${actionsHTML}
                </div>
            `;

            container.appendChild(card);
        }

    } catch (error) {
        console.error("Load projects error:", error);
        loadMockProjects();
    }
}





//Mock data
function loadMockProjects() {
    const mockProjects = [
        { id: 1, title: "AI Climate Research", goal: "5.0", raised: "3.2" },
        { id: 2, title: "Quantum Computing", goal: "10.0", raised: "7.5" },
        { id: 3, title: "Energy Storage", goal: "8.0", raised: "2.1" }
    ];

    const container = document.getElementById('projectsList');
    container.innerHTML = '';

    mockProjects.forEach(project => {
        const percent = (parseFloat(project.raised) / parseFloat(project.goal)) * 100;

        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
            <h4>${project.title}</h4>
            <div class="stats">
                <div class="stat">
                    <span>Goal:</span>
                    <span>${project.goal} ETH</span>
                </div>
                <div class="stat">
                    <span>Raised:</span>
                    <span>${project.raised} ETH</span>
                </div>
            </div>
            <div class="progress">
                <div class="progress-bar" style="width: ${percent}%"></div>
            </div>
            <div class="actions">
                <button onclick="alert('Connect wallet first')">Contribute</button>
            </div>
        `;
        container.appendChild(card);
    });
}

async function createProject() {
    if (!userAddress) {
        alert('Connect wallet first!');
        return;
    }

    const title = prompt('Project title:');
    if (!title) return;

    const goal = prompt('Goal (ETH):');
    if (!goal || parseFloat(goal) <= 0) return;

    const days = prompt('Duration (days):');
    if (!days || parseInt(days) <= 0) return;

    try {
        const goalWei = ethers.utils.parseEther(goal);
        const durationSeconds = parseInt(days);

        const tx = await fundingContract.createProject(title, goalWei, durationSeconds);
        alert('Transaction sent! Wait...');
        await tx.wait();

        alert('Project created!');
        loadProjects();

    } catch (error) {
        console.error("Create error:", error);
        alert('Failed: ' + (error && error.message ? error.message : String(error)));
    }
}

//Contribute
async function contribute(projectId) {
    if (!userAddress) {
        alert('Connect wallet first!');
        return;
    }

    const amount = prompt('Amount (ETH):');
    if (!amount || parseFloat(amount) <= 0) return;

    try {
        const amountWei = ethers.utils.parseEther(amount);
        const tx = await fundingContract.contribute(projectId, { value: amountWei });

        alert('Transaction sent! Wait...');
        await tx.wait();

        alert(`Contributed ${amount} ETH! You got ${parseFloat(amount) * 100} RST tokens!`);
        loadProjects();
        updateBalances();

    } catch (error) {
        console.error("Contribute error:", error);
        alert('Failed: ' + (error && error.message ? error.message : String(error)));
    }
}

// Finalize
async function finalizeProject(projectId) {
    if (!userAddress) {
        alert('Connect wallet first!');
        return;
    }

    try {
        const tx = await fundingContract.finalizeProject(projectId);
        alert('Transaction sent! Wait...');
        await tx.wait();

        alert('Project finalized!');
        loadProjects();

    } catch (error) {
        console.error("Finalize error:", error);
        alert('Failed: ' + (error && error.message ? error.message : String(error)));
    }
}

//Withdraw
async function withdraw(projectId) {
    if (!userAddress) {
        alert('Connect wallet first!');
        return;
    }

    try {
        const tx = await fundingContract.withdraw(projectId);
        alert('Transaction sent! Wait...');
        await tx.wait();

        alert('Funds withdrawn!');
        loadProjects();
        updateBalances();

    } catch (error) {
        console.error("Withdraw error:", error);
        alert('Failed: ' + (error && error.message ? error.message : String(error)));
    }
}

//Refund
async function refund(projectId) {
    if (!userAddress) {
        alert('Connect wallet first!');
        return;
    }

    try {
        const tx = await fundingContract.refund(projectId);
        alert('Transaction sent! Wait...');
        await tx.wait();

        alert('Refund received!');
        loadProjects();
        updateBalances();

    } catch (error) {
        console.error("Refund error:", error);
        alert('Failed: ' + (error && error.message ? error.message : String(error)));
    }
}

document.addEventListener('DOMContentLoaded', loadProjects);
