// Import any dependencies
import { machineData, totalPulls } from './slotMachine.js';
import { Distributions } from './distributions.js';

let payoutChart = null;
let machineConfigs = [];
let optimalStrategyTotalPayout = 0;
let bestMachineTotalPayout = 0;
let bestMachineIndex = -1;

// Function to initialize the chart
function initializeChart(configs) {
    machineConfigs = configs;
    
    // Reset values
    optimalStrategyTotalPayout = 0;
    bestMachineTotalPayout = 0;
    bestMachineIndex = -1;
    
    // Determine best machine based on expected value
    determineBestMachine();
    
    const ctx = document.getElementById('chart').getContext('2d');
    
    // Create three main datasets
    const datasets = [
        {
            label: 'Your Total Payout',
            data: [0],
            borderColor: 'rgba(0, 0, 0, 1)',
            backgroundColor: 'rgba(0, 0, 0, 0.1)',
            fill: false,
            borderWidth: 3,
            tension: 0.1
        },
        {
            label: 'Optimal Strategy Total',
            data: [0],
            borderColor: 'rgba(220, 20, 60, 1)', // Crimson
            backgroundColor: 'rgba(220, 20, 60, 0.1)',
            fill: false,
            borderDash: [5, 5],
            borderWidth: 2,
            tension: 0.1
        },
        {
            label: 'Best Machine Total',
            data: [0],
            borderColor: 'rgba(50, 205, 50, 1)', // Lime Green
            backgroundColor: 'rgba(50, 205, 50, 0.1)',
            fill: false,
            borderDash: [10, 5],
            borderWidth: 2,
            tension: 0.1
        }
    ];
    
    // Create the chart
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
        }
        
        if (ev > highestEV) {
            highestEV = ev;
            bestMachineIndex = index;
        }
    });
    
    console.log(`Best machine determined to be Machine ${bestMachineIndex + 1} with EV ${highestEV}`);
}

// Function to update the chart after each lever pull
function updateChart() {
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
    
    // Update optimal strategy by simulating a new pull
    simulateOptimalStrategy();
    payoutChart.data.datasets[1].data.push(optimalStrategyTotalPayout);
    
    // Keep only the last maxDataPoints
    if (payoutChart.data.datasets[1].data.length > maxDataPoints) {
        payoutChart.data.datasets[1].data = payoutChart.data.datasets[1].data.slice(-maxDataPoints);
    }
    
    // Update best machine by simulating a new pull
    simulateBestMachine();
    payoutChart.data.datasets[2].data.push(bestMachineTotalPayout);
    
    // Keep only the last maxDataPoints
    if (payoutChart.data.datasets[2].data.length > maxDataPoints) {
        payoutChart.data.datasets[2].data = payoutChart.data.datasets[2].data.slice(-maxDataPoints);
    }
    
    // Update the chart
    payoutChart.update();
    
    // Log current state for debugging
    console.log(`Pull ${totalPulls}: Your=${userTotalPayout.toFixed(2)}, Optimal=${optimalStrategyTotalPayout.toFixed(2)}, Best=${bestMachineTotalPayout.toFixed(2)}`);
}

// Helper function to simulate optimal strategy using UCB1 algorithm
function simulateOptimalStrategy() {
    if (!window.optimalMachineEstimates || machineConfigs.length === 0) return;
    
    // Find the machine with highest UCB
    let bestMachineId = 0;
    let bestUCB = -Infinity;
    
    window.optimalMachineEstimates.forEach(machine => {
        // Update UCB for each machine
        if (machine.pulls > 0) {
            // UCB1 algorithm
            const exploration = Math.sqrt(2 * Math.log(totalPulls) / machine.pulls);
            machine.ucb = machine.mean + exploration;
        } else {
            machine.ucb = Infinity; // Unexplored machines have infinite potential
        }
        
        if (machine.ucb > bestUCB) {
            bestUCB = machine.ucb;
            bestMachineId = machine.id;
        }
    });
    
    // Find the configuration for the best machine
    const bestMachine = machineConfigs.find(config => config.id === bestMachineId);
    if (!bestMachine) return;
    
    // Simulate pulling the lever of the best machine
    const payout = Distributions.sample(bestMachine.distribution, bestMachine.parameters);
    
    // Update estimates for the selected machine
    const machineEstimate = window.optimalMachineEstimates.find(m => m.id === bestMachineId);
    if (!machineEstimate) return;
    
    machineEstimate.pulls++;
    machineEstimate.totalPayout += payout;
    machineEstimate.mean = machineEstimate.totalPayout / machineEstimate.pulls;
    
    // Add to total optimal strategy payout
    optimalStrategyTotalPayout += payout;
}

// Helper function to simulate always picking the best machine
function simulateBestMachine() {
    if (bestMachineIndex === -1 || bestMachineIndex >= machineConfigs.length) return;
    
    // Get the best machine configuration
    const bestMachine = machineConfigs[bestMachineIndex];
    if (!bestMachine) return;
    
    // Simulate pulling the lever of the best machine
    const payout = Distributions.sample(bestMachine.distribution, bestMachine.parameters);
    
    // Add to total best machine payout
    bestMachineTotalPayout += payout;
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
export { initializeChart, updateChart };