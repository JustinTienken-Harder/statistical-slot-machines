// Import the Distributions module
import { Distributions } from './distributions.js';
import { updateChart } from './chart.js';
import { updateRegretChart } from './regretChart.js';
import { StrategyFactory } from './strategies/Strategy.js';

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

// Global variable to hold the strategy
let optimalStrategy = null;

// Global variable to hold the strategy manager
let strategyManager = null;

// Function to set the strategy manager
function setStrategyManager(manager) {
    strategyManager = manager;
}

// Function to initialize the optimal strategy
async function initializeStrategy(configs, strategyType = 'ucb', options = {}) {
    try {
        console.log(`Initializing ${strategyType} strategy with options:`, options);
        
        optimalStrategy = await StrategyFactory.createStrategy(strategyType, configs, options);
        console.log(`${strategyType} strategy initialized successfully:`, optimalStrategy);
        
        return optimalStrategy;
    } catch (error) {
        console.error("Error initializing strategy:", error);
        // Fallback to UCB if the requested strategy fails
        console.log("Falling back to UCB strategy");
        try {
            optimalStrategy = await StrategyFactory.createStrategy('ucb', configs);
            return optimalStrategy;
        } catch (fallbackError) {
            console.error("Fallback strategy initialization also failed:", fallbackError);
            return null;
        }
    }
}

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
    
    // Reset strategy if it exists
    if (optimalStrategy) {
        optimalStrategy.reset();
    }
}

// Hard mode tracking with better state management
let hardModeEnabled = false;
let originalMachineConfigs = [];
let currentMachineConfigs = []; // Add tracking of current configuration

// Function to toggle hard mode
function toggleHardMode(enabled) {
    hardModeEnabled = enabled;
    console.log(`Hard Mode ${hardModeEnabled ? 'Enabled' : 'Disabled'}`);
    
    // If enabling hard mode, refresh machine configs
    if (enabled) {
        captureCurrentMachineConfigs();
    }
}

// Function to store the original machine configurations
function setOriginalMachineConfigs(configs) {
    originalMachineConfigs = JSON.parse(JSON.stringify(configs)); // Deep copy
    currentMachineConfigs = JSON.parse(JSON.stringify(configs)); // Initialize current configs
    console.log("Original machine configurations stored:", originalMachineConfigs);
}

// Function to get current machine configurations from the DOM
function captureCurrentMachineConfigs() {
    const configs = [];
    
    // Collect configurations from the DOM
    for (let i = 0; i < originalMachineConfigs.length; i++) {
        const statsElement = document.getElementById(`stats-${i}`);
        if (statsElement) {
            // Get distribution type
            const distribText = statsElement.querySelector('p:nth-child(3)').textContent;
            const distribMatch = distribText.match(/Distribution: (.+)/);
            const distribution = distribMatch ? distribMatch[1].toLowerCase() : 'normal';
            
            // Get parameters
            const paramsText = statsElement.querySelector('p:nth-child(4)').textContent;
            const paramsMatch = paramsText.match(/Parameters: (.+)/);
            const params = paramsMatch 
                ? paramsMatch[1].split(', ').map(p => parseFloat(p))
                : [0, 1];
            
            configs.push({
                id: i,
                distribution,
                parameters: params
            });
        }
    }
    
    currentMachineConfigs = configs; // Update current configuration state
    console.log("Current machine configs captured:", configs);
    return configs;
}

// Public function to force a permutation (for testing)
function forcePermutation() {
    console.log("🧪 FORCING PERMUTATION FOR TESTING");
    permuteAndUpdateMachines();
}

// Helper function to perform the permutation and update displays
function permuteAndUpdateMachines() {
    if (!currentMachineConfigs || !currentMachineConfigs.length) {
        console.error("No machine configurations to permute!");
        return false;
    }
    
    console.log("🔄 Starting permutation of distributions!");
    console.log("Configuration before permutation:", JSON.parse(JSON.stringify(currentMachineConfigs)));
    
    // Create a copy of the current configurations
    const oldConfigs = JSON.parse(JSON.stringify(currentMachineConfigs));
    const shuffledConfigs = JSON.parse(JSON.stringify(currentMachineConfigs));
    
    // Fisher-Yates shuffle of the configurations
    for (let i = shuffledConfigs.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        
        // Only swap the distribution and parameters, not the IDs
        [shuffledConfigs[i].distribution, shuffledConfigs[j].distribution] = 
            [shuffledConfigs[j].distribution, shuffledConfigs[i].distribution];
        
        [shuffledConfigs[i].parameters, shuffledConfigs[j].parameters] = 
            [shuffledConfigs[j].parameters, shuffledConfigs[i].parameters];
    }
    
    // Check if any machines actually changed
    let changesDetected = false;
    for (let i = 0; i < oldConfigs.length; i++) {
        if (oldConfigs[i].distribution !== shuffledConfigs[i].distribution ||
            !arraysEqual(oldConfigs[i].parameters, shuffledConfigs[i].parameters)) {
            changesDetected = true;
            console.log(`Machine ${i+1} changed from ${oldConfigs[i].distribution} to ${shuffledConfigs[i].distribution}`);
            break;
        }
    }
    
    // If no changes detected, try again
    if (!changesDetected) {
        console.log("⚠️ No changes detected after shuffle. Re-shuffling...");
        return permuteAndUpdateMachines(); // Recursive call
    }
    
    // Update the currentMachineConfigs state with the permuted configs
    currentMachineConfigs = shuffledConfigs;
    console.log("Configurations after permutation:", JSON.parse(JSON.stringify(currentMachineConfigs)));
    
    // Update machine displays with the new configurations (only visible in stats)
    updateMachineDisplays();
        
    return true;
}

// Helper to check if two arrays are equal
function arraysEqual(a, b) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false;
    }
    return true;
}

// Update the machine displays to show the new configurations
function updateMachineDisplays() {
    currentMachineConfigs.forEach(config => {
        const statsElement = document.getElementById(`stats-${config.id}`);
        if (statsElement) {
            // Format parameters for display
            const formattedParams = config.parameters.map(p => p.toString()).join(', ');
            
            // Update distribution and parameters displays
            const distribElement = statsElement.querySelector('p:nth-child(3)');
            const paramsElement = statsElement.querySelector('p:nth-child(4)');
            
            if (distribElement) {
                distribElement.textContent = `Distribution: ${config.distribution.charAt(0).toUpperCase() + config.distribution.slice(1)}`;
            }
            
            if (paramsElement) {
                paramsElement.textContent = `Parameters: ${formattedParams}`;
            }
            
            console.log(`Updated machine ${config.id + 1}'s display to ${config.distribution} with params [${formattedParams}]`);
        }
    });
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

// Function to generate payouts for all machines in a single round
function generateRoundPayouts(pulledMachineId, actualPayout) {
    let roundPayouts = {};
    
    // For each machine configuration
    currentMachineConfigs.forEach(config => {
        if (config.id === pulledMachineId) {
            // For the machine that was pulled, use the actual result
            roundPayouts[config.id] = actualPayout;
        } else {
            // For other machines, sample from their distributions
            const payout = Distributions.sample(config.distribution, config.parameters);
            roundPayouts[config.id] = payout;
        }
    });
    
    console.log("Round payouts generated:", roundPayouts);
    return roundPayouts;
}

function pullLever(machineId, distribution, parameters) {
    // Hard Mode: Check for permutation with a 5% chance
    if (hardModeEnabled && Math.random() < 0.05) {
        console.log("💫 Hard Mode triggered a permutation!");
        permuteAndUpdateMachines();
    }
    
    // Get the current distribution and parameters for this machine
    // This ensures we're using the potentially updated configuration after permutation
    let currentDistribution = distribution;
    let currentParameters = parameters;
    
    // Find the current configuration for this machine
    const machineConfig = currentMachineConfigs.find(config => config.id === machineId);
    if (machineConfig) {
        currentDistribution = machineConfig.distribution;
        currentParameters = machineConfig.parameters;
        console.log(`Using machine ${machineId + 1}'s current config: ${currentDistribution} with params [${currentParameters}]`);
    }
    
    // Sample from the distribution using the current (possibly swapped) configuration
    const payout = Distributions.sample(currentDistribution, currentParameters);
    const formattedPayout = payout.toFixed(2);
    
    // Store the result for this pull (used by optimal strategy)
    latestPullResults[totalPulls] = {
        machineId,
        payout
    };
    
    // Update display
    const resultElement = document.getElementById(`result-${machineId}`);
    // Add dollar sign here
    resultElement.textContent = '$' + formattedPayout;
    
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
        '$' + (machineData[machineId].totalPayout / machineData[machineId].pulls).toFixed(2);
    
    // Generate payouts for all machines in this round
    const roundPayouts = generateRoundPayouts(machineId, payout);
    
    // Update total pulls
    totalPulls++;
    
    // DON'T update strategies with user pulls - instead use simulated payouts
    if (strategyManager) {
        // Update strategies with simulated payouts for their recommendations
        strategyManager.simulateStrategiesWithPayouts(roundPayouts);
        
        // Get recommendations from all active strategies WITHOUT updating them with this pull
        const recommendations = strategyManager.getRecommendations();
        
        // Update charts using the recommendations
        updateChart(machineId, payout, recommendations);
        
        // Update regret chart with all recommendations
        updateRegretChart(machineId, null, recommendations);
    }
}

// Export the necessary functions and data
export { 
    createSlotMachine, 
    totalPulls, 
    machineData, 
    latestPullResults, 
    resetMachineData,
    toggleHardMode,
    setOriginalMachineConfigs,
    forcePermutation,
    currentMachineConfigs,
    setStrategyManager,
    initializeStrategy,
    optimalStrategy,
    generateRoundPayouts  // Export the new function
};