import { machineData, totalPulls } from './slotMachine.js';
import { Distributions } from './distributions.js';

let regretChart = null;
let machineConfigs = [];
let userCumulativeRegret = 0;
let strategyRegrets = {}; // Track regret for each strategy
let bestMachineIndex = -1;
let bestMachineEV = 0; // Add this to track best machine's EV

// Function to reset/destroy the regret chart
function resetRegretChart() {
    if (regretChart) {
        // Destroy the existing chart to prevent memory leaks
        regretChart.destroy();
        regretChart = null;
    }
    
    // Reset data
    userCumulativeRegret = 0;
    strategyRegrets = {}; // Reset all strategy regrets
    bestMachineIndex = -1;
    bestMachineEV = 0;
    machineConfigs = [];
}

// Initialize the regret chart
function initializeRegretChart(configs) {
    // Reset the chart first to prevent duplicates
    resetRegretChart();
    
    machineConfigs = configs;
    
    // Determine best machine based on expected value
    determineBestMachine();
    
    const ctx = document.getElementById('regret-chart').getContext('2d');
    
    // Define the viridis colors explicitly
    const YOUR_COLOR = '#440154'; // Dark purple
    
    // Create datasets for user regret with updated colors
    const datasets = [
        {
            label: 'Your Cumulative Regret',
            data: [0],
            borderColor: YOUR_COLOR,
            backgroundColor: `${YOUR_COLOR}20`, // 20 is hex for 12% opacity
            fill: false,
            borderWidth: 3,
            tension: 0.1
        }
    ];
    
    // Add options to handle being hidden initially
    const options = {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            x: {
                title: {
                    display: true,
                    text: 'Number of Pulls'
                },
                ticks: {
                    maxTicksLimit: 10
                }
            },
            y: {
                title: {
                    display: true,
                    text: 'Cumulative Regret'
                },
                min: 0 // Regret should never be negative
            }
        },
        plugins: {
            title: {
                display: true,
                text: 'Cumulative Regret Analysis'
            },
            tooltip: {
                mode: 'index',
                intersect: false
            },
            legend: {
                display: true,
                position: 'top',
                labels: {
                    boxWidth: 12,
                    font: {
                        size: 11
                    }
                }
            }
        },
        animation: {
            duration: 0 // Disable animation for better performance
        },
        // Add responsive resizing
        onResize: function(chart, size) {
            // This ensures the chart renders properly when container becomes visible
            setTimeout(() => {
                chart.resize();
            }, 0);
        }
    };
    
    // Create the chart with updated options
    regretChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [0], // Start with pull 0
            datasets: datasets
        },
        options: options
    });
    
    // Add listener for window resize to handle chart visibility changes
    window.addEventListener('resize', function() {
        if (regretChart) {
            regretChart.resize();
        }
    });
    
    console.log(`Regret chart initialized with best machine index ${bestMachineIndex} (EV: ${bestMachineEV.toFixed(3)})`);
}

// Function to determine the best machine based on expected value
function determineBestMachine() {
    let highestEV = -Infinity;
    
    machineConfigs.forEach((config, index) => {
        let ev = getExpectedValue(config);
        
        if (ev > highestEV) {
            highestEV = ev;
            bestMachineIndex = index;
            bestMachineEV = ev;  // Store the best machine's expected value
        }
    });
    
    console.log(`Best machine for regret calculation: Machine ${bestMachineIndex + 1} with EV ${bestMachineEV.toFixed(3)}`);
}

// Calculate expected value for a given machine
function getExpectedValue(machine) {
    switch(machine.distribution) {
        case 'normal':
            return machine.parameters[0]; // Mean
        case 'uniform':
            return (machine.parameters[0] + machine.parameters[1]) / 2; // (min + max) / 2
        case 'exponential':
            return 1 / machine.parameters[0]; // 1 / rate
        case 'poisson':
            return machine.parameters[0]; // lambda
        case 'chi-squared':
            return machine.parameters[0]; // degrees of freedom
        case 'bernoulli':
            return machine.parameters[0]; // p (directly the success probability)
        default:
            return 0;
    }
}

// Helper function to add a dataset for a new strategy
function addStrategyRegretDataset(strategyType) {
    const strategyColors = {
        'ucb': '#4285F4',      // Google Blue
        'ns-ucb': '#34A853',   // Google Green
        'abtest': '#FBBC05',   // Google Yellow
        'exp3': '#EA4335',     // Google Red
        'exp3r': '#8F44AD'     // Purple
    };
    
    const color = strategyColors[strategyType] || '#999999';
    
    // Create a new dataset for this strategy
    const newDataset = {
        label: getStrategyLabel(strategyType) + ' Regret',
        data: [],
        borderColor: color,
        backgroundColor: `${color}20`,
        fill: false,
        borderWidth: 2,
        tension: 0.1
    };
    
    // Fill the dataset with zeros up to the current label count
    if (regretChart && regretChart.data && regretChart.data.labels) {
        for (let i = 0; i < regretChart.data.labels.length - 1; i++) {
            newDataset.data.push(0);
        }
    }
    
    // Add the dataset to the chart
    if (regretChart && regretChart.data && regretChart.data.datasets) {
        regretChart.data.datasets.push(newDataset);
    }
}

// Helper function to get a friendly label for a strategy type
function getStrategyLabel(strategyType) {
    const labels = {
        'ucb': 'UCB',
        'ns-ucb': 'Non-Stationary UCB',
        'abtest': 'A/B Testing',
        'exp3': 'EXP3',
        'exp3r': 'EXP3-R'
    };
    
    return labels[strategyType] || strategyType;
}

// Update the regret chart after each pull
function updateRegretChart(machinePulled, optimalMachineId, recommendations) {
    if (!regretChart || bestMachineIndex === -1 || bestMachineEV === 0) {
        console.warn("Cannot update regret chart: not properly initialized");
        return;
    }
    
    // Get pulled machine's expected value
    const pulledMachine = machineConfigs.find(m => m.id === parseInt(machinePulled));
    if (!pulledMachine) {
        console.warn(`Machine ${machinePulled} not found in configs`);
        return;
    }
    
    const pulledEV = getExpectedValue(pulledMachine);
    
    // Calculate user regret (difference between best possible EV and chosen machine's EV)
    // Note: regret is always non-negative since it represents loss compared to optimal
    const userRegret = Math.max(0, bestMachineEV - pulledEV);
    
    // Accumulate user regret
    userCumulativeRegret += userRegret;
    
    // Process all strategy recommendations
    recommendations = recommendations || {};
    
    // For each strategy in the recommendations
    for (const strategyType in recommendations) {
        const recommendedMachineId = recommendations[strategyType];
        const recommendedMachine = machineConfigs.find(m => m.id === recommendedMachineId);
        
        if (!recommendedMachine) {
            console.warn(`Recommended machine ${recommendedMachineId} for ${strategyType} not found`);
            continue;
        }
        
        const recommendedEV = getExpectedValue(recommendedMachine);
        
        // Calculate strategy regret against best machine EV
        // Even the best strategy should have some regret unless it always picks the best machine
        const strategyRegret = Math.max(0, bestMachineEV - recommendedEV);
        
        // Initialize or update the strategy's cumulative regret
        if (strategyRegrets[strategyType] === undefined) {
            strategyRegrets[strategyType] = 0;
            // Add a new dataset for this strategy
            addStrategyRegretDataset(strategyType);
        }
        
        // Accumulate regret for this strategy
        strategyRegrets[strategyType] += strategyRegret;
        
        // Log the regret calculation for debugging
        console.log(`${strategyType} regret: ${strategyRegret.toFixed(3)} (Best EV: ${bestMachineEV.toFixed(3)}, Recommended EV: ${recommendedEV.toFixed(3)})`);
    }
    
    // Limit the number of data points to prevent chart from becoming too large
    const maxDataPoints = 100;
    
    // Update labels (number of pulls)
    regretChart.data.labels.push(totalPulls);
    
    // Keep only the last maxDataPoints
    if (regretChart.data.labels.length > maxDataPoints) {
        regretChart.data.labels = regretChart.data.labels.slice(-maxDataPoints);
    }
    
    // Update user regret dataset (index 0)
    regretChart.data.datasets[0].data.push(userCumulativeRegret);
    
    // Keep only the last maxDataPoints
    if (regretChart.data.datasets[0].data.length > maxDataPoints) {
        regretChart.data.datasets[0].data = regretChart.data.datasets[0].data.slice(-maxDataPoints);
    }
    
    // Update strategy regret datasets
    for (const strategyType in strategyRegrets) {
        // Find the dataset for this strategy
        const strategyDatasetIndex = regretChart.data.datasets.findIndex(ds => 
            ds.label && ds.label.includes(getStrategyLabel(strategyType))
        );
        
        if (strategyDatasetIndex !== -1) {
            // Update dataset with new value
            regretChart.data.datasets[strategyDatasetIndex].data.push(strategyRegrets[strategyDatasetIndex]);
            
            // Keep only the last maxDataPoints
            if (regretChart.data.datasets[strategyDatasetIndex].data.length > maxDataPoints) {
                regretChart.data.datasets[strategyDatasetIndex].data = 
                    regretChart.data.datasets[strategyDatasetIndex].data.slice(-maxDataPoints);
            }
        }
    }
    
    try {
        // Ensure all datasets have the same length
        const expectedLength = regretChart.data.labels.length;
        regretChart.data.datasets.forEach(dataset => {
            // Fill with last value if dataset is shorter than expected
            while (dataset.data.length < expectedLength) {
                const lastValue = dataset.data.length > 0 ? dataset.data[dataset.data.length - 1] : 0;
                dataset.data.push(lastValue);
            }
            
            // Trim if dataset is longer than expected
            if (dataset.data.length > expectedLength) {
                dataset.data = dataset.data.slice(0, expectedLength);
            }
        });
    
        // Only update the visual chart if it's visible
        const regretChartContainer = document.getElementById('regret-chart-container');
        if (regretChartContainer && !regretChartContainer.classList.contains('hidden')) {
            regretChart.update('none'); // Use 'none' mode to skip animations
        }
    } catch (error) {
        console.error("Error updating regret chart:", error);
    }
    
    // Log regret for debugging
    console.log(`Pull ${totalPulls} Regret - User: $${userRegret.toFixed(3)} (Total: $${userCumulativeRegret.toFixed(3)})`);
    for (const strategyType in strategyRegrets) {
        console.log(`  ${strategyType}: Total: $${strategyRegrets[strategyType].toFixed(3)}`);
    }
}

export { initializeRegretChart, updateRegretChart, resetRegretChart };
