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
    
    // Update optimal strategy
    updateOptimalStrategy(optimalMachineId, pulledMachineId, actualPayout);
    payoutChart.data.datasets[1].data.push(optimalStrategyTotalPayout);
    
    // Keep only the last maxDataPoints
    if (payoutChart.data.datasets[1].data.length > maxDataPoints) {
        payoutChart.data.datasets[1].data = payoutChart.data.datasets[1].data.slice(-maxDataPoints);
    }
    
    // Calculate best possible payout for this round
    const bestPossiblePayout = findBestPossiblePayout();
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
}

// Helper function to find the best possible payout for the current round
function findBestPossiblePayout() {
    // Sample from all machines and find the best payout
    let bestPayout = -Infinity;
    
    machineConfigs.forEach(machine => {
        // Sample each machine to see what it would have paid
        const payout = Distributions.sample(machine.distribution, machine.parameters);
        if (payout > bestPayout) {
            bestPayout = payout;
        }
    });
    
    return bestPayout;
}

// Helper function to update optimal strategy
function updateOptimalStrategy(optimalMachineId, pulledMachineId, actualPayout) {
    if (!window.optimalMachineEstimates || machineConfigs.length === 0) return;
    
    // If optimal machine is the same as pulled machine, use the same payout
    let payout;
    if (optimalMachineId === pulledMachineId) {
        payout = actualPayout;
    } else {
        // Otherwise sample from the distribution
        const optimalMachine = machineConfigs.find(config => config.id === optimalMachineId);
        if (!optimalMachine) return;
        payout = Distributions.sample(optimalMachine.distribution, optimalMachine.parameters);
    }
    
    // Update estimates for the selected machine
    const machineEstimate = window.optimalMachineEstimates.find(m => m.id === optimalMachineId);
    if (!machineEstimate) return;
    
    machineEstimate.pulls++;
    machineEstimate.totalPayout += payout;
    machineEstimate.mean = machineEstimate.totalPayout / machineEstimate.pulls;
    
    // Add to total optimal strategy payout
    optimalStrategyTotalPayout += payout;
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