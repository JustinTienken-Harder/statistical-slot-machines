// Import any dependencies
import { machineData, totalPulls, latestPullResults } from './slotMachine.js';
import { Distributions } from './distributions.js';

let payoutChart = null;
let machineConfigs = [];
let strategyPayouts = {}; // Track payouts for each strategy
let bestPossibleTotalPayout = 0;
let bestMachineIndex = -1;
let bestMachineEV = 0; // Define this variable to fix the reference error

// Function to reset/destroy the chart
function resetChart() {
    if (payoutChart) {
        // Destroy the existing chart to prevent memory leaks
        payoutChart.destroy();
        payoutChart = null;
    }
    
    // Reset data
    strategyPayouts = {};
    bestPossibleTotalPayout = 0;
    bestMachineIndex = -1;
    bestMachineEV = 0; // Reset this variable as well
    machineConfigs = [];
}

// Function to initialize the chart
function initializeChart(configs) {
    // Reset the chart first to prevent duplicates
    resetChart();
    
    machineConfigs = configs;
    
    // Determine best machine based on expected value
    determineBestMachine();
    
    const ctx = document.getElementById('chart').getContext('2d');
    
    // Define base datasets
    const datasets = [
        {
            label: 'Your Total Payout',
            data: [0],
            borderColor: '#440154', // Dark purple
            backgroundColor: `#44015420`,
            fill: false,
            borderWidth: 3,
            tension: 0.1
        },
        {
            label: 'Best Possible Total',
            data: [0],
            borderColor: '#FDE725', // Yellow
            backgroundColor: `#FDE72520`,
            fill: false,
            borderDash: [10, 5],
            borderWidth: 2,
            tension: 0.1
        }
    ];
    
    // Create the chart with explicit options
    payoutChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [0], // Start with pull 0
            datasets: datasets
        },
        options: {
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
                        text: 'Total Payout ($)'
                    },
                    ticks: {
                        callback: function(value) {
                            return '$' + value.toFixed(2);
                        }
                    }
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: 'Total Accumulated Payouts'
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
            elements: {
                line: {
                    tension: 0.4 // Smooth curves
                },
                point: {
                    radius: 2, // Smaller points
                    hoverRadius: 5 // Larger on hover
                }
            }
        }
    });
    
    // Initialize optimization strategies with all machines
    window.optimalMachineEstimates = configs.map(config => ({
        id: config.id,
        pulls: 0,
        totalPayout: 0,
        mean: 0,
        ucb: Infinity
    }));
}

// Function to determine the best machine based on expected value
function determineBestMachine() {
    let highestEV = -Infinity;
    bestMachineIndex = -1; // Reset before determining
    bestMachineEV = -Infinity; // Also reset this value
    
    machineConfigs.forEach((config, index) => {
        let ev = 0;
        switch(config.distribution) {
            case 'normal':
                ev = config.parameters[0]; // Mean
                break;
            case 'uniform':
                ev = (config.parameters[0] + config.parameters[1]) / 2; // (min + max) / 2
                break;
            case 'exponential':
                ev = 1 / config.parameters[0]; // 1 / rate
                break;
            case 'poisson':
                ev = config.parameters[0]; // lambda
                break;
            case 'chi-squared':
                ev = config.parameters[0]; // degrees of freedom
                break;
            case 'bernoulli':
                ev = config.parameters[0]; // p (directly the success probability)
                break;
        }
        
        if (ev > highestEV) {
            highestEV = ev;
            bestMachineIndex = index;
            bestMachineEV = ev; // Properly assign the value here
        }
    });
    
    console.log(`Best machine determined to be Machine ${bestMachineIndex + 1} with EV ${bestMachineEV}`);
}

// Function to update the chart after each lever pull
function updateChart(pulledMachineId, actualPayout, recommendations) {
    if (!payoutChart || bestMachineIndex === -1) return;
    
    // Limit the number of data points to prevent the chart from becoming too large
    const maxDataPoints = 100;
    
    // Update labels (number of pulls)
    payoutChart.data.labels.push(totalPulls);
    
    // Keep only the last maxDataPoints
    if (payoutChart.data.labels.length > maxDataPoints) {
        payoutChart.data.labels = payoutChart.data.labels.slice(-maxDataPoints);
    }
    
    // Calculate total user payout across all machines
    const userTotalPayout = getTotalUserPayout();
    
    // Update Your Total Payout dataset (index 0)
    payoutChart.data.datasets[0].data.push(userTotalPayout);
    
    // Keep only the last maxDataPoints
    if (payoutChart.data.datasets[0].data.length > maxDataPoints) {
        payoutChart.data.datasets[0].data = payoutChart.data.datasets[0].data.slice(-maxDataPoints);
    }
    
    // Generate payouts for all machines in this round to ensure consistency
    const roundPayouts = generateConsistentRoundPayouts(pulledMachineId, actualPayout);
    
    // Make sure recommendations is an object (even if empty)
    recommendations = recommendations || {};
    
    // Update payouts for each strategy using the strategy recommendations
    for (const strategyType in recommendations) {
        const optimalMachineId = recommendations[strategyType];
        
        // Make sure we have a valid machine ID and can find it in roundPayouts
        if (optimalMachineId === undefined || roundPayouts[optimalMachineId] === undefined) {
            console.warn(`Skip updating chart for ${strategyType}: Invalid machine ID ${optimalMachineId}`);
            continue;
        }
        
        const strategyPayout = roundPayouts[optimalMachineId];
        
        // Initialize strategy payout if needed
        if (strategyPayouts[strategyType] === undefined) {
            strategyPayouts[strategyType] = 0;
            
            // Initialize the dataset for this strategy
            addStrategyDataset(strategyType);
        }
        
        // Accumulate payout for this strategy
        strategyPayouts[strategyType] += strategyPayout;
        
        // Find the dataset index for this strategy
        const datasetIndex = payoutChart.data.datasets.findIndex(ds => 
            ds.label && ds.label.includes(getStrategyLabel(strategyType))
        );
        
        if (datasetIndex !== -1) {
            // Ensure we have a data array initialized for this dataset
            if (!payoutChart.data.datasets[datasetIndex].data) {
                payoutChart.data.datasets[datasetIndex].data = [];
            }
            
            // Initialize with zeros if the array doesn't have enough elements
            while (payoutChart.data.datasets[datasetIndex].data.length < payoutChart.data.labels.length - 1) {
                payoutChart.data.datasets[datasetIndex].data.push(0);
            }
            
            // Update the dataset with the new payout
            payoutChart.data.datasets[datasetIndex].data.push(strategyPayouts[strategyType]);
            
            // Keep only the last maxDataPoints
            if (payoutChart.data.datasets[datasetIndex].data.length > maxDataPoints) {
                payoutChart.data.datasets[datasetIndex].data = 
                    payoutChart.data.datasets[datasetIndex].data.slice(-maxDataPoints);
            }
            
            console.log(`Updated chart for ${strategyType}: value=${strategyPayouts[strategyType].toFixed(2)}`);
        } else {
            console.warn(`Dataset for strategy ${strategyType} not found`);
        }
    }
    
    // Find the best possible payout from all machines for this round
    const bestPossiblePayout = Math.max(...Object.values(roundPayouts));
    bestPossibleTotalPayout += bestPossiblePayout;
    
    // Make sure the best possible dataset index is valid
    const bestPossibleIndex = payoutChart.data.datasets.length - 1;
    if (bestPossibleIndex >= 0) {
        payoutChart.data.datasets[bestPossibleIndex].data.push(bestPossibleTotalPayout);
        
        // Keep only the last maxDataPoints
        if (payoutChart.data.datasets[bestPossibleIndex].data.length > maxDataPoints) {
            payoutChart.data.datasets[bestPossibleIndex].data = 
                payoutChart.data.datasets[bestPossibleIndex].data.slice(-maxDataPoints);
        }
    }
    
    try {
        // Ensure all datasets have the same length
        const expectedLength = payoutChart.data.labels.length;
        payoutChart.data.datasets.forEach(dataset => {
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
        
        // Update the chart with try-catch to prevent errors
        payoutChart.update('none'); // Use 'none' mode to skip animations
    } catch (error) {
        console.error("Error updating chart:", error);
    }
    
    // Log current state for debugging
    let optimalStrategyTotalPayout = 0;
    for (const type in strategyPayouts) {
        if (strategyPayouts[type] > optimalStrategyTotalPayout) {
            optimalStrategyTotalPayout = strategyPayouts[type];
        }
    }
    console.log(`Pull ${totalPulls}: Your=$${userTotalPayout.toFixed(2)}, Optimal=$${optimalStrategyTotalPayout.toFixed(2)}, Best Possible=$${bestPossibleTotalPayout.toFixed(2)}`);
}

// Helper function to add a dataset for a new strategy
function addStrategyDataset(strategyType) {
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
        label: getStrategyLabel(strategyType),
        data: [],  // Start with an empty array
        borderColor: color,
        backgroundColor: `${color}20`,
        fill: false,
        borderWidth: 2,
        tension: 0.1
    };
    
    // Fill the dataset with zeros up to the current label count
    if (payoutChart && payoutChart.data && payoutChart.data.labels) {
        for (let i = 0; i < payoutChart.data.labels.length - 1; i++) {
            newDataset.data.push(0);
        }
    }
    
    // Insert the new dataset before the best possible dataset
    // Make sure we have at least one dataset before trying to insert
    if (payoutChart && payoutChart.data && payoutChart.data.datasets && payoutChart.data.datasets.length > 0) {
        payoutChart.data.datasets.splice(payoutChart.data.datasets.length - 1, 0, newDataset);
    } else {
        console.error("Cannot add strategy dataset: chart not properly initialized");
    }
}

// Helper function to get a friendly label for a strategy type
function getStrategyLabel(strategyType) {
    const labels = {
        'ucb': 'UCB Strategy',
        'ns-ucb': 'Non-Stationary UCB',
        'abtest': 'A/B Testing',
        'exp3': 'EXP3 Strategy',
        'exp3r': 'EXP3-R Strategy'
    };
    
    return labels[strategyType] || strategyType;
}

// Helper function to generate consistent payouts for all machines in a single round
function generateConsistentRoundPayouts(pulledMachineId, actualPayout) {
    const roundPayouts = {};
    
    // Use the same seed for all machines in this round to ensure consistency
    const roundSeed = totalPulls;
    
    // For each machine, either use the actual result if it was pulled, or generate a consistent one
    machineConfigs.forEach(machine => {
        if (machine.id === parseInt(pulledMachineId)) {
            // Use the actual payout for the machine that was pulled
            roundPayouts[machine.id] = actualPayout;
        } else {
            // Generate a deterministic payout based on the round number and machine ID
            // Use a simple hash function to generate a "random" but consistent value
            const hash = (roundSeed * 9301 + machine.id * 49297) % 233280;
            const randomValue = hash / 233280;
            
            // Use this deterministic random value to sample from the distribution
            let payout;
            switch(machine.distribution) {
                case 'bernoulli':
                    payout = randomValue < machine.parameters[0] ? 1 : 0;
                    break;
                case 'normal':
                    // Simplified normal approximation using the deterministic random value
                    const u1 = randomValue;
                    const u2 = (hash * 7919) % 233280 / 233280; // Another "random" value
                    const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
                    payout = machine.parameters[0] + machine.parameters[1] * z;
                    break;
                // Add cases for other distributions as needed
                default:
                    // For other distributions, use the Distributions module with a fixed seed
                    payout = Distributions.sample(machine.distribution, machine.parameters);
            }
            roundPayouts[machine.id] = payout;
        }
    });
    
    return roundPayouts;
}

// Helper function to get total payout across all machines
function getTotalUserPayout() {
    let total = 0;
    
    // Sum all machine payouts
    for (const machineId in machineData) {
        if (machineData.hasOwnProperty(machineId)) {
            total += machineData[machineId].totalPayout;
        }
    }
    
    return total;
}

// Export the chart functions
export { initializeChart, updateChart, resetChart };