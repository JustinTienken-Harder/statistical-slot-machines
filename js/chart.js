// Import any dependencies
import { machineData, totalPulls, latestPullResults } from './slotMachine.js';
import { Distributions } from './distributions.js';

let payoutChart = null;
let machineConfigs = [];
let optimalStrategyTotalPayout = 0;
let bestPossibleTotalPayout = 0; // Changed name to reflect actual best possible payout
let bestMachineIndex = -1;
let bestMachineEV = 0;

// Function to reset/destroy the chart
function resetChart() {
    if (payoutChart) {
        // Destroy the existing chart to prevent memory leaks
        payoutChart.destroy();
        payoutChart = null;
    }
    
    // Reset data
    optimalStrategyTotalPayout = 0;
    bestPossibleTotalPayout = 0;
    bestMachineIndex = -1;
    bestMachineEV = 0;
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
    
    // Define the viridis colors explicitly
    const YOUR_COLOR = '#440154'; // Dark purple
    const OPTIMAL_COLOR = '#21918c'; // Teal
    const BEST_COLOR = '#FDE725'; // Yellow
    
    // Create three main datasets with updated colors from viridis palette
    const datasets = [
        {
            label: 'Your Total Payout',
            data: [0],
            borderColor: YOUR_COLOR,
            backgroundColor: `${YOUR_COLOR}20`, // 20 is hex for 12% opacity
            fill: false,
            borderWidth: 3,
            tension: 0.1
        },
        {
            label: 'Optimal Strategy Total',
            data: [0],
            borderColor: OPTIMAL_COLOR,
            backgroundColor: `${OPTIMAL_COLOR}20`,
            fill: false,
            borderDash: [5, 5],
            borderWidth: 2,
            tension: 0.1
        },
        {
            label: 'Best Possible Total',
            data: [0],
            borderColor: BEST_COLOR,
            backgroundColor: `${BEST_COLOR}20`,
            fill: false,
            borderDash: [10, 5],
            borderWidth: 2,
            tension: 0.1
        }
    ];
    
    // Create the chart with explicit options to ensure colors are applied
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
                        maxTicksLimit: 10 // Limit the number of x-axis ticks
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Total Payout'
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
            bestMachineEV = ev; // Store the expected value
        }
    });
    
    console.log(`Best machine determined to be Machine ${bestMachineIndex + 1} with EV ${bestMachineEV}`);
}

// Function to update the chart after each lever pull
function updateChart(pulledMachineId, actualPayout, optimalMachineId) {
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
    // This will be used for both optimal strategy and best possible calculations
    const roundPayouts = generateConsistentRoundPayouts(pulledMachineId, actualPayout);
    
    // Update optimal strategy using the consistent payouts
    const optimalPayout = roundPayouts[optimalMachineId];
    optimalStrategyTotalPayout += optimalPayout;
    payoutChart.data.datasets[1].data.push(optimalStrategyTotalPayout);
    
    // Update UCB estimates for optimal strategy
    updateOptimalStrategyEstimates(optimalMachineId, optimalPayout);
    
    // Keep only the last maxDataPoints
    if (payoutChart.data.datasets[1].data.length > maxDataPoints) {
        payoutChart.data.datasets[1].data = payoutChart.data.datasets[1].data.slice(-maxDataPoints);
    }
    
    // Find the best possible payout from all machines for this round
    const bestPossiblePayout = Math.max(...Object.values(roundPayouts));
    bestPossibleTotalPayout += bestPossiblePayout;
    payoutChart.data.datasets[2].data.push(bestPossibleTotalPayout);
    
    // Keep only the last maxDataPoints
    if (payoutChart.data.datasets[2].data.length > maxDataPoints) {
        payoutChart.data.datasets[2].data = payoutChart.data.datasets[2].data.slice(-maxDataPoints);
    }
    
    // Update the chart
    payoutChart.update();
    
    // Log current state for debugging
    console.log(`Pull ${totalPulls}: Your=${userTotalPayout.toFixed(2)}, Optimal=${optimalStrategyTotalPayout.toFixed(2)}, Best Possible=${bestPossibleTotalPayout.toFixed(2)}`);
    console.log(`Round payouts:`, roundPayouts);
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

// Helper function to update optimal strategy estimates
function updateOptimalStrategyEstimates(optimalMachineId, payout) {
    if (!window.optimalMachineEstimates) return;
    
    // Update estimates for the selected machine
    const machineEstimate = window.optimalMachineEstimates.find(m => m.id === optimalMachineId);
    if (!machineEstimate) return;
    
    machineEstimate.pulls++;
    machineEstimate.totalPayout += payout;
    machineEstimate.mean = machineEstimate.totalPayout / machineEstimate.pulls;
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