// Import the Distributions module
import { Distributions } from './distributions.js';
import { updateChart } from './chart.js';
import { updateRegretChart } from './regretChart.js';

class SlotMachine {
    constructor(name, distributionFunc, payoutFunc) {
        this.name = name;
        this.distributionFunc = distributionFunc;
        this.payoutFunc = payoutFunc;
        this.totalPayout = 0;
        this.spins = 0;
    }

    spin() {
        const result = this.distributionFunc();
        const payout = this.payoutFunc(result);
        this.totalPayout += payout;
        this.spins++;
        return { result, payout };
    }

    getAveragePayout() {
        return this.spins > 0 ? this.totalPayout / this.spins : 0;
    }

    reset() {
        this.totalPayout = 0;
        this.spins = 0;
    }
}

function createSlotMachines(distributions) {
    const machines = [];
    distributions.forEach(dist => {
        const machine = new SlotMachine(dist.name, dist.distributionFunc, dist.payoutFunc);
        machines.push(machine);
    });
    return machines;
}

function spinAllMachines(machines) {
    return machines.map(machine => machine.spin());
}

function resetMachines(machines) {
    machines.forEach(machine => machine.reset());
}

// Slot machine creation and functionality

let totalPulls = 0;
const machineData = {};

// Keep track of the latest pull result for each machine to ensure consistency
const latestPullResults = {};

// Function to reset all machine data
function resetMachineData() {
    // Reset total pulls
    totalPulls = 0;
    
    // Clear machine data
    for (const key in machineData) {
        delete machineData[key];
    }
    
    // Clear latest pull results
    for (const key in latestPullResults) {
        delete latestPullResults[key];
    }
}

function createSlotMachine(config) {
    const { id, distribution, parameters } = config;
    
    // Initialize machine data for tracking
    machineData[id] = {
        pulls: 0,
        totalPayout: 0,
        payouts: []
    };
    
    // Create machine element
    const machineElement = document.createElement('div');
    machineElement.className = 'slot-machine';
    
    // Format parameters based on distribution type without rounding
    const formattedParams = parameters.map(param => {
        // For Bernoulli distribution, use the exact value entered by the user
        if (distribution === 'bernoulli') {
            // Display the exact parameter value without converting to a fixed number of decimal places
            return param.toString();
        }
        // For other distributions, don't round to 2 decimal places
        return param.toString();
    }).join(', ');
    
    machineElement.innerHTML = `
        <div class="machine-header">
            <h3>Machine ${id + 1}</h3>
        </div>
        <div class="machine-display">
            <div class="result" id="result-${id}">?</div>
        </div>
        <div class="machine-stats" id="stats-${id}">
            <p>Pulls: <span id="pulls-${id}">0</span></p>
            <p>Avg Payout: <span id="avg-payout-${id}">0.00</span></p>
            <p>Distribution: ${distribution.charAt(0).toUpperCase() + distribution.slice(1)}</p>
            <p>Parameters: ${formattedParams}</p>
        </div>
        <div class="machine-buttons">
            <button class="pull-lever" data-machine="${id}">Pull Lever</button>
            <button class="toggle-stats" data-stats="${id}">Stats</button>
        </div>
    `;
    
    // Add event listener for the lever pull
    const leverButton = machineElement.querySelector('.pull-lever');
    leverButton.addEventListener('click', function(event) {
        event.stopPropagation(); // Prevent triggering the machine click event
        const machineId = parseInt(this.getAttribute('data-machine'));
        pullLever(machineId, distribution, parameters);
    });
    
    // Add event listener for the toggle stats button
    const toggleButton = machineElement.querySelector('.toggle-stats');
    toggleButton.addEventListener('click', function(event) {
        event.stopPropagation(); // Prevent triggering the machine click event
        const statsId = this.getAttribute('data-stats');
        const statsElement = document.getElementById(`stats-${statsId}`);
        if (statsElement.style.display === 'block') {
            statsElement.style.display = 'none';
            this.textContent = 'Show Stats';
        } else {
            statsElement.style.display = 'block';
            this.textContent = 'Hide Stats';
        }
    });
    
    // Add click event listener to the entire machine element
    machineElement.addEventListener('click', function() {
        // Don't trigger if clicking on buttons (handled by stopPropagation above)
        pullLever(id, distribution, parameters);
        
        // Add a visual feedback for the click
        this.classList.add('machine-clicked');
        setTimeout(() => {
            this.classList.remove('machine-clicked');
        }, 200);
    });
    
    return machineElement;
}

function pullLever(machineId, distribution, parameters) {
    // Sample from the distribution
    const payout = Distributions.sample(distribution, parameters);
    const formattedPayout = payout.toFixed(2);
    
    // Store the result for this pull (used by optimal strategy)
    latestPullResults[totalPulls] = {
        machineId,
        payout
    };
    
    // Update display
    const resultElement = document.getElementById(`result-${machineId}`);
    resultElement.textContent = formattedPayout;
    
    // Apply different styling for negative payouts
    if (payout < 0) {
        resultElement.classList.add('negative');
    } else {
        resultElement.classList.remove('negative');
    }
    
    // Update stats
    machineData[machineId].pulls++;
    machineData[machineId].totalPayout += parseFloat(formattedPayout);
    machineData[machineId].payouts.push(parseFloat(formattedPayout));
    
    document.getElementById(`pulls-${machineId}`).textContent = machineData[machineId].pulls;
    document.getElementById(`avg-payout-${machineId}`).textContent = 
        (machineData[machineId].totalPayout / machineData[machineId].pulls).toFixed(2);
    
    // Update total pulls
    totalPulls++;
    
    // Get optimal machine from UCB algorithm
    let optimalMachineId = 0;
    let bestUCB = -Infinity;
    
    if (window.optimalMachineEstimates) {
        window.optimalMachineEstimates.forEach(machine => {
            if (machine.pulls > 0) {
                const exploration = Math.sqrt(2 * Math.log(totalPulls) / machine.pulls);
                machine.ucb = machine.mean + exploration;
            } else {
                machine.ucb = Infinity;
            }
            
            if (machine.ucb > bestUCB) {
                bestUCB = machine.ucb;
                optimalMachineId = machine.id;
            }
        });
    }
    
    // Update charts
    updateChart(machineId, payout, optimalMachineId);
    updateRegretChart(machineId, optimalMachineId);
}

// Export the necessary functions and data
export { createSlotMachine, totalPulls, machineData, latestPullResults, resetMachineData };