// Import necessary modules
import { Distributions } from './distributions.js';
import OptimalStrategy from './optimalStrategy.js';
import { 
    createSlotMachine, 
    resetMachineData, 
    toggleHardMode, 
    setOriginalMachineConfigs,
    forcePermutation,
    setStrategyManager
} from './slotMachine.js';
import { initializeChart, resetChart } from './chart.js';
import { initializeRegretChart, resetRegretChart } from './regretChart.js';
import { MultiStrategyManager } from './multiStrategy.js';

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
    
    // Create the strategy manager
    const strategyManager = new MultiStrategyManager();
    
    // Set the strategy manager in slotMachine.js
    setStrategyManager(strategyManager);
    
    // Initialize sidebar functionality
    initializeSidebar(strategyManager);
    
    // DOM Elements for Hard Mode with improved selector
    const hardModeToggle = document.getElementById('hard-mode');
    
    // Log element existence and add debug info to page
    console.log('Hard Mode Toggle Element:', hardModeToggle);
    
    // Add a debug element to show hard mode status with test button
    const debugElement = document.createElement('div');
    debugElement.id = 'hard-mode-status';
    debugElement.style.padding = '5px';
    debugElement.style.margin = '10px 0';
    debugElement.style.backgroundColor = '#f0f0f0';
    debugElement.style.border = '1px solid #ccc';
    debugElement.innerHTML = `
        Hard Mode Status: Disabled
        <button id="force-permute" class="test-button" style="display:none">
            Test Permutation
        </button>
    `;
    document.querySelector('.mode-toggle-container').appendChild(debugElement);
    
    // Add event listener for force permute button
    const forcePermuteButton = document.getElementById('force-permute');
    if (forcePermuteButton) {
        forcePermuteButton.addEventListener('click', function() {
            forcePermutation();
        });
    }
    
    // Add event listener for hard mode toggle with enhanced feedback
    if (hardModeToggle) {
        hardModeToggle.addEventListener('change', function() {
            const isEnabled = this.checked;
            console.log('Hard Mode Toggled:', isEnabled);
            toggleHardMode(isEnabled);
            
            // Update visual status
            const statusElement = document.getElementById('hard-mode-status');
            const testButton = document.getElementById('force-permute');
            
            if (statusElement) {
                statusElement.textContent = `Hard Mode Status: ${isEnabled ? 'ENABLED' : 'Disabled'}`;
                statusElement.className = isEnabled ? 'enabled' : '';
                
                // Show/hide test button
                if (testButton) {
                    testButton.style.display = isEnabled ? 'inline-block' : 'none';
                }
            }
            
            // For Hard Mode, change default strategy to Non-Stationary UCB
            if (isEnabled) {
                // Clear UCB default badge
                const ucbBadge = document.querySelector('#strategy-ucb + label .badge-default');
                if (ucbBadge) ucbBadge.style.display = 'none';
                
                // Add recommended badge to NS-UCB and EXP3R
                ensureRecommendedBadge('strategy-ns-ucb');
                ensureRecommendedBadge('strategy-exp3r');
                
                // Select NS-UCB by default if no other adaptive strategy is selected
                const hasAdaptiveStrategy = strategyManager.selectedTypes.some(
                    type => type === 'ns-ucb' || type === 'exp3r'
                );
                
                if (!hasAdaptiveStrategy) {
                    document.getElementById('strategy-ns-ucb').checked = true;
                    // Update selected strategies immediately
                    updateSelectedStrategies(strategyManager);
                }
                
                alert('Hard Mode enabled! There is now a 5% chance that distributions will silently swap between machines when pulling a lever. The Non-Stationary UCB strategy has been recommended for better performance.');
            } else {
                // Restore UCB default badge
                const ucbBadge = document.querySelector('#strategy-ucb + label .badge-default');
                if (ucbBadge) ucbBadge.style.display = '';
                
                // Remove recommended badges
                const recommendedBadges = document.querySelectorAll('.badge-recommended');
                recommendedBadges.forEach(badge => badge.remove());
            }
        });
    } else {
        console.error('Hard Mode toggle element not found!');
        // Try to create it if missing
        createHardModeToggle();
    }
    
    // Function to create hard mode toggle if missing
    function createHardModeToggle() {
        const container = document.createElement('div');
        container.className = 'mode-toggle-container';
        container.innerHTML = `
            <label class="hard-mode-label">Hard Mode (5% chance of distributions swapping)</label>
            <div class="toggle-switch">
                <input type="checkbox" id="hard-mode">
                <label for="hard-mode" class="toggle-slider"></label>
            </div>
        `;
        
        // Insert after number of machines input
        const numMachinesGroup = document.querySelector('.form-group');
        if (numMachinesGroup && numMachinesGroup.parentNode) {
            numMachinesGroup.parentNode.insertBefore(container, numMachinesGroup.nextSibling);
            
            // Add event listener to the newly created toggle
            const newToggle = document.getElementById('hard-mode');
            if (newToggle) {
                newToggle.addEventListener('change', function() {
                    toggleHardMode(this.checked);
                    if (this.checked) {
                        alert('Hard Mode enabled! There is now a 5% chance that distributions will randomly swap when pulling a lever. Good luck!');
                    }
                });
            }
        }
    }
    
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
            // Set step value based on distribution and parameter type
            let stepValue = "0.01"; // Default step for most parameters
            
            // Set special step value for Bernoulli distribution
            if (distributionType === 'bernoulli') {
                stepValue = "0.001"; // Finer step for probability
            }
            
            html += `
                <div class="form-group">
                    <label for="param-${machineIndex}-${i}">${param}:</label>
                    <input type="number" id="param-${machineIndex}-${i}" class="param-input" 
                        step="${stepValue}" value="${getDefaultValue(distributionType, i)}">
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
    
    async function generateSlotMachines() {
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
        
        // Store the original configurations for Hard Mode
        setOriginalMachineConfigs(machineConfigs);
        
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
        
        // Initialize the strategy manager with machine configurations
        await strategyManager.initialize(machineConfigs);
    }

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
    async function generateRandomMachines() {
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
        
        // Store the original configurations for Hard Mode
        setOriginalMachineConfigs(machineConfigs);
        
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
        
        // REMOVE strategy type selection from dropdown, and only use sidebar
        // Instead of getting strategy from dropdown, initialize using all selected strategies
        try {
            // Skip the strategy initialization here since we'll use the sidebar's strategies
            await strategyManager.initialize(machineConfigs);
            console.log("All selected strategies initialized successfully");
        } catch (error) {
            console.error("Error initializing strategies:", error);
        }
        
        // Scroll to machines
        document.getElementById('slot-machines').scrollIntoView({ behavior: 'smooth' });
    }
    
    // Function to generate reasonable random parameters for each distribution type
    function generateRandomParameters(distributionType) {
        switch (distributionType) {
            case 'normal':
                // Mean between -5 and 5, StdDev between 0.5 and 3
                return [
                    parseFloat((Math.random() * 10 - 5).toFixed(2)),
                    parseFloat((Math.random() * 2.5 + 0.5).toFixed(2))
                ];
            case 'uniform':
                // Generate min and max with at least 1 unit difference
                const min = parseFloat((Math.random() * 10 - 5).toFixed(2));
                const max = parseFloat((min + 1 + Math.random() * 5).toFixed(2));
                return [min, max];
            case 'chi-squared':
                // Degrees of freedom between 1 and 10
                return [Math.floor(Math.random() * 10) + 1];
            case 'exponential':
                // Rate parameter between 0.5 and 5
                return [parseFloat((Math.random() * 4.5 + 0.5).toFixed(2))];
            case 'poisson':
                // Lambda (rate) between 0.5 and 10
                return [parseFloat((Math.random() * 9.5 + 0.5).toFixed(2))];
            case 'bernoulli':
                // Success probability between 0.1 and 0.9 with 3 decimal places
                return [parseFloat((Math.random() * 0.8 + 0.1).toFixed(3))];
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

    // Add this at the end to ensure the sidebar functionality is properly initialized
    // Test sidebar toggle on page load with a delay
    setTimeout(() => {
        // Force a click test to make sure the handler works
        console.log("Testing sidebar toggle...");
        const sidebarToggle = document.getElementById('sidebar-toggle');
        const sidebar = document.getElementById('strategy-sidebar');
        
        if (sidebarToggle && sidebar) {
            console.log("Sidebar elements found for auto test");
            console.log("Current sidebar right value:", getComputedStyle(sidebar).right);
            
            // Check if the toggle is properly set up
            if (typeof sidebarToggle.onclick !== 'function') {
                console.warn("Sidebar toggle doesn't have a click handler! Re-initializing...");
                
                // Direct click handler as a fallback
                sidebarToggle.onclick = function() {
                    console.log("Direct fallback click handler triggered");
                    sidebar.classList.toggle('open');
                    sidebarToggle.classList.toggle('open');
                };
            }
            
            // Also add keyboard shortcut for easy testing
            document.addEventListener('keydown', function(event) {
                if (event.key === 'S' && event.ctrlKey) {  // Ctrl+S toggles sidebar
                    event.preventDefault(); // Prevent save dialog
                    sidebarToggle.click();
                }
            });
        } else {
            console.error("Could not find sidebar elements for auto test");
        }
    }, 1000);
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

// Function to ensure a recommended badge exists for a strategy
function ensureRecommendedBadge(strategyId) {
    const strategyLabel = document.querySelector(`#${strategyId} + label`);
    if (!strategyLabel) return;
    
    // Check if badge already exists
    let badge = strategyLabel.querySelector('.badge-recommended');
    if (!badge) {
        badge = document.createElement('span');
        badge.className = 'strategy-badge badge-recommended';
        badge.textContent = 'Recommended';
        strategyLabel.appendChild(badge);
    } else {
        badge.style.display = '';
    }
}

// Initialize sidebar functionality
function initializeSidebar(strategyManager) {
    console.log("Initializing sidebar...");
    const sidebar = document.getElementById('strategy-sidebar');
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const applyButton = document.getElementById('apply-strategies');
    const strategyCheckboxes = document.querySelectorAll('.strategy-checkbox');
    
    // Make sure sidebar elements exist
    if (!sidebar || !sidebarToggle) {
        console.error("Sidebar elements not found:", { 
            sidebar: sidebar ? "exists" : "missing", 
            toggle: sidebarToggle ? "exists" : "missing" 
        });
        return;
    } else {
        console.log("Sidebar elements found:", {
            sidebar: sidebar,
            toggle: sidebarToggle
        });
    }
    
    // Add direct click handler to toggle button with debugging
    sidebarToggle.onclick = function(event) {
        console.log("Toggle button clicked");
        event.preventDefault(); // Prevent any default action
        
        // Toggle sidebar visibility
        if (sidebar.classList.contains('open')) {
            console.log("Closing sidebar");
            sidebar.classList.remove('open');
            sidebarToggle.classList.remove('open');
            
            // Change icon
            const icon = sidebarToggle.querySelector('.icon');
            if (icon) icon.textContent = '⚙️';
        } else {
            console.log("Opening sidebar");
            sidebar.classList.add('open');
            sidebarToggle.classList.add('open');
            
            // Change icon
            const icon = sidebarToggle.querySelector('.icon');
            if (icon) icon.textContent = '✖';
        }
        
        // Report the state after toggle
        console.log("Sidebar state after toggle:", {
            sidebarOpen: sidebar.classList.contains('open'),
            toggleOpen: sidebarToggle.classList.contains('open'),
            sidebarRight: getComputedStyle(sidebar).right
        });
    };
    
    // Show settings section for selected strategies
    strategyCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            const strategyType = this.dataset.strategy;
            const settingsSection = document.getElementById(`settings-${strategyType}`);
            
            if (settingsSection) {
                if (this.checked) {
                    settingsSection.classList.add('active');
                } else {
                    settingsSection.classList.remove('active');
                }
            }
        });
    });
    
    // Apply button updates selected strategies
    if (applyButton) {
        applyButton.addEventListener('click', function() {
            updateSelectedStrategies(strategyManager);
            
            // Add success feedback
            this.classList.add('success');
            setTimeout(() => {
                this.classList.remove('success');
            }, 1000);
            
            // Close sidebar with a slight delay to show the animation
            setTimeout(() => {
                sidebar.classList.remove('open');
                sidebarToggle.classList.remove('open');
                const icon = sidebarToggle.querySelector('.icon');
                if (icon) icon.textContent = '⚙️';
            }, 300);
        });
    }
    
    // For immediate debugging
    if (strategyManager && typeof strategyManager.testSidebarToggle === 'function') {
        // Add a small delay to make sure everything is loaded
        setTimeout(() => {
            strategyManager.testSidebarToggle();
        }, 500);
    }
    
    // Manually verify the click handler is properly attached
    console.log("Sidebar click handler set:", !!sidebarToggle.onclick);
}

// Update selected strategies in the manager
function updateSelectedStrategies(strategyManager) {
    const strategyCheckboxes = document.querySelectorAll('.strategy-checkbox:checked');
    const selectedTypes = Array.from(strategyCheckboxes).map(cb => cb.dataset.strategy);
    
    // Gather options for each selected strategy
    const options = {};
    
    selectedTypes.forEach(type => {
        switch(type) {
            case 'ns-ucb':
                options[type] = {
                    windowSize: parseInt(document.getElementById('window-size').value) || 20,
                    changeDetectionThreshold: parseInt(document.getElementById('change-threshold').value) || 50
                };
                break;
                
            case 'abtest':
                options[type] = {
                    samplesPerMachine: parseInt(document.getElementById('samples-per-machine').value) || 10
                };
                break;
                
            case 'exp3':
                options[type] = {
                    gamma: parseFloat(document.getElementById('exp3-gamma').value) || 0.1,
                    eta: parseFloat(document.getElementById('exp3-eta').value) || 0.1
                };
                break;
                
            case 'exp3r':
                options[type] = {
                    gamma: parseFloat(document.getElementById('exp3r-gamma').value) || 0.1,
                    eta: parseFloat(document.getElementById('exp3r-eta').value) || 0.1,
                    windowSize: parseInt(document.getElementById('exp3r-window').value) || 20,
                    thresholdMultiplier: parseFloat(document.getElementById('exp3r-threshold').value) || 2.0
                };
                break;
        }
        
        // Update options in the manager
        if (options[type]) {
            strategyManager.updateStrategyOptions(type, options[type]);
        }
    });
    
    // Update strategies in the manager
    strategyManager.updateSelectedStrategies(selectedTypes);
}