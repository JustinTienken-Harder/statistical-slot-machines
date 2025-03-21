// Import necessary modules
import { Distributions } from './distributions.js';
import OptimalStrategy from './optimalStrategy.js';
import { createSlotMachine, resetMachineData } from './slotMachine.js';
import { initializeChart, resetChart } from './chart.js';
import { initializeRegretChart, resetRegretChart } from './regretChart.js';

const distributions = {
    normal: (mean, stdDev) => {
        return Math.random() * stdDev + mean; // Simplified normal distribution
    },
    uniform: (min, max) => {
        return Math.random() * (max - min) + min;
    },
    chiSquared: (degreesOfFreedom) => {
        let sum = 0;
        for (let i = 0; i < degreesOfFreedom; i++) {
            sum += Math.pow(Math.random(), 2);
        }
        return sum;
    },
    bernoulli: (p) => {
        // Return 1 with probability p, 0 with probability 1-p
        return Math.random() < p ? 1 : 0;
    }
};

let selectedDistribution = null;
let parameters = {};

document.addEventListener('DOMContentLoaded', () => {
    const distributionSelect = document.getElementById('distribution-select');
    if (!distributionSelect) {
        console.error('distributionSelect element not found');
        return;
    }
    const parameterInputs = document.querySelectorAll('.parameter-input');
    const submitButton = document.getElementById('submit-button');
    const slotMachineContainer = document.getElementById('slot-machine-container');
    const payoutChartContainer = document.getElementById('payout-chart');

    distributionSelect.addEventListener('change', (event) => {
        selectedDistribution = event.target.value;
        updateParameterInputs(selectedDistribution);
    });

    submitButton.addEventListener('click', () => {
        parameters = getParameters();
        createSlotMachines();
        renderChart();
    });

    // DOM Elements
    const numMachinesInput = document.getElementById('num-machines');
    const machineConfigsContainer = document.getElementById('machine-configs');
    const generateButton = document.getElementById('generate-machines');
    const randomMachinesButton = document.getElementById('random-machines');
    const machinesContainer = document.getElementById('machines-container');
    
    // Distribution types and their required parameters
    const distributionTypes = {
        'normal': ['Mean', 'Standard Deviation'],
        'uniform': ['Minimum', 'Maximum'],
        'chi-squared': ['Degrees of Freedom'],
        'exponential': ['Rate Parameter'],
        'poisson': ['Lambda (Rate)'],
        'bernoulli': ['Success Probability']
    };
    
    // Initialize machine configurations
    updateMachineConfigs();
    
    // Event Listeners
    numMachinesInput.addEventListener('change', updateMachineConfigs);
    generateButton.addEventListener('click', generateSlotMachines);
    randomMachinesButton.addEventListener('click', generateRandomMachines);
    
    function updateMachineConfigs() {
        const numMachines = parseInt(numMachinesInput.value);
        
        // Clear previous configurations
        machineConfigsContainer.innerHTML = '';
        
        // Generate new configuration forms
        for (let i = 0; i < numMachines; i++) {
            const machineConfig = document.createElement('div');
            machineConfig.className = 'machine-config';
            machineConfig.innerHTML = `
                <h3>Machine ${i + 1}</h3>
                <div class="form-group">
                    <label for="distribution-${i}">Distribution:</label>
                    <select id="distribution-${i}" class="distribution-select" data-machine="${i}">
                        ${Object.keys(distributionTypes).map(dist => 
                            `<option value="${dist}">${dist.charAt(0).toUpperCase() + dist.slice(1)}</option>`
                        ).join('')}
                    </select>
                </div>
                <div id="params-container-${i}" class="params-container">
                    ${createParameterInputs(i, 'normal')}
                </div>
            `;
            machineConfigsContainer.appendChild(machineConfig);
            
            // Add event listener to update parameter inputs when distribution changes
            const select = machineConfig.querySelector(`#distribution-${i}`);
            select.addEventListener('change', function() {
                const machineIndex = this.getAttribute('data-machine');
                const selectedDist = this.value;
                const paramsContainer = document.getElementById(`params-container-${machineIndex}`);
                paramsContainer.innerHTML = createParameterInputs(machineIndex, selectedDist);
            });
        }
    }
    
    function createParameterInputs(machineIndex, distributionType) {
        const params = distributionTypes[distributionType];
        let html = '';
        
        params.forEach((param, i) => {
            html += `
                <div class="form-group">
                    <label for="param-${machineIndex}-${i}">${param}:</label>
                    <input type="number" id="param-${machineIndex}-${i}" class="param-input" step="0.1" value="${getDefaultValue(distributionType, i)}">
                </div>
            `;
        });
        
        return html;
    }
    
    function getDefaultValue(distributionType, paramIndex) {
        const defaults = {
            'normal': [0, 1],
            'uniform': [0, 1],
            'chi-squared': [1],
            'exponential': [1],
            'poisson': [1],
            'bernoulli': [0.5]
        };
        
        return defaults[distributionType][paramIndex] || 0;
    }
    
    function generateSlotMachines() {
        // Reset previous state
        resetCharts();
        
        const numMachines = parseInt(numMachinesInput.value);
        const machineConfigs = [];
        
        // Collect machine configurations
        for (let i = 0; i < numMachines; i++) {
            const distributionType = document.getElementById(`distribution-${i}`).value;
            const params = [];
            const paramInputs = document.querySelectorAll(`#params-container-${i} .param-input`);
            
            paramInputs.forEach(input => {
                params.push(parseFloat(input.value));
            });
            
            machineConfigs.push({
                id: i,
                distribution: distributionType,
                parameters: params
            });
        }
        
        // Clear previous machines
        machinesContainer.innerHTML = '';
        
        // Create slot machines
        machineConfigs.forEach(config => {
            const machine = createSlotMachine(config);
            machinesContainer.appendChild(machine);
        });
        
        // Initialize charts with machine configurations
        initializeChart(machineConfigs);
        initializeRegretChart(machineConfigs);
        
        // Initialize optimal strategy
        initializeOptimalStrategy(machineConfigs);
    }

    // Make initializeOptimalStrategy available
    window.initializeOptimalStrategy = function(configs) {
        // Initialize estimates for each machine
        window.optimalMachineEstimates = configs.map(config => ({
            id: config.id,
            pulls: 0,
            totalPayout: 0,
            mean: 0,
            ucb: Infinity // Upper Confidence Bound
        }));
    };

    // Add event listener for regret chart toggle
    const toggleRegretChartButton = document.getElementById('toggle-regret-chart');
    const regretChartContainer = document.getElementById('regret-chart-container');
    
    if (toggleRegretChartButton && regretChartContainer) {
        toggleRegretChartButton.addEventListener('click', function() {
            regretChartContainer.classList.toggle('hidden');
            this.textContent = regretChartContainer.classList.contains('hidden') 
                ? 'Show Regret Chart' 
                : 'Hide Regret Chart';
                
            // If revealing the chart, we may need to resize it
            if (!regretChartContainer.classList.contains('hidden')) {
                window.dispatchEvent(new Event('resize'));
            }
        });
    }

    // Function to generate random machines
    function generateRandomMachines() {
        // Reset previous state
        resetCharts();
        
        // Get number of machines from input (or generate random number between 2-8)
        const numMachines = parseInt(numMachinesInput.value) || Math.floor(Math.random() * 7) + 2;
        
        // Update the input value to match the number of machines we'll create
        numMachinesInput.value = numMachines;
        
        // Array of distribution types
        const distTypes = Object.keys(distributionTypes);
        
        // Create array to hold machine configurations
        const machineConfigs = [];
        
        // Create random machine configurations
        for (let i = 0; i < numMachines; i++) {
            // Select a random distribution type
            const distributionType = distTypes[Math.floor(Math.random() * distTypes.length)];
            
            // Generate reasonable random parameters based on distribution type
            const params = generateRandomParameters(distributionType);
            
            machineConfigs.push({
                id: i,
                distribution: distributionType,
                parameters: params
            });
        }
        
        // Clear previous machines
        machinesContainer.innerHTML = '';
        
        // Create slot machines
        machineConfigs.forEach(config => {
            const machine = createSlotMachine(config);
            machinesContainer.appendChild(machine);
        });
        
        // Initialize charts with machine configurations
        initializeChart(machineConfigs);
        initializeRegretChart(machineConfigs);
        
        // Initialize optimal strategy
        initializeOptimalStrategy(machineConfigs);
        
        // Scroll to machines
        document.getElementById('slot-machines').scrollIntoView({ behavior: 'smooth' });
    }
    
    // Function to generate reasonable random parameters for each distribution type
    function generateRandomParameters(distributionType) {
        switch (distributionType) {
            case 'normal':
                // Mean between -5 and 5, StdDev between 0.5 and 3
                return [
                    parseFloat((Math.random() * 10 - 5).toFixed(1)),
                    parseFloat((Math.random() * 2.5 + 0.5).toFixed(1))
                ];
            case 'uniform':
                // Generate min and max with at least 1 unit difference
                const min = parseFloat((Math.random() * 10 - 5).toFixed(1));
                const max = parseFloat((min + 1 + Math.random() * 5).toFixed(1));
                return [min, max];
            case 'chi-squared':
                // Degrees of freedom between 1 and 10
                return [Math.floor(Math.random() * 10) + 1];
            case 'exponential':
                // Rate parameter between 0.5 and 5
                return [parseFloat((Math.random() * 4.5 + 0.5).toFixed(1))];
            case 'poisson':
                // Lambda (rate) between 0.5 and 10
                return [parseFloat((Math.random() * 9.5 + 0.5).toFixed(1))];
            case 'bernoulli':
                // Success probability between 0.1 and 0.9
                return [parseFloat((Math.random() * 0.8 + 0.1).toFixed(2))];
            default:
                return [0];
        }
    }
    
    // Function to reset all charts and machine data
    function resetCharts() {
        // Reset chart data
        resetChart();
        resetRegretChart();
        
        // Reset machine data
        resetMachineData();
    }
});

function updateParameterInputs(distribution) {
    // Logic to show/hide parameter inputs based on selected distribution
}

function getParameters() {
    // Logic to gather parameters from input fields
}

function createSlotMachines() {
    // Logic to create slot machines based on selected distribution and parameters
}

function renderChart() {
    // Logic to render the payout chart using the charting library
}