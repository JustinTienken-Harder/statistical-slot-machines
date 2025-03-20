// Import the Distributions module
import { Distributions } from './distributions.js';
import { updateChart } from './chart.js';

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
            <p>Parameters: ${parameters.map(p => p.toFixed(1)).join(', ')}</p>
        </div>
        <div class="machine-buttons">
            <button class="pull-lever" data-machine="${id}">Pull Lever</button>
            <button class="toggle-stats" data-stats="${id}">Stats</button>
        </div>
    `;
    
    // Add event listener for the lever pull
    const leverButton = machineElement.querySelector('.pull-lever');
    leverButton.addEventListener('click', function() {
        const machineId = parseInt(this.getAttribute('data-machine'));
        pullLever(machineId, distribution, parameters);
    });
    
    // Add event listener for the toggle stats button
    const toggleButton = machineElement.querySelector('.toggle-stats');
    toggleButton.addEventListener('click', function() {
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
    
    return machineElement;
}

function pullLever(machineId, distribution, parameters) {
    // Sample from the distribution
    const payout = Distributions.sample(distribution, parameters);
    const formattedPayout = payout.toFixed(2); // Allow negative valuesth.max(0, payout) to allow negative values
    
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
    
    // Update chart
    updateChart();
}

// Export the necessary functions
export { createSlotMachine, totalPulls, machineData };