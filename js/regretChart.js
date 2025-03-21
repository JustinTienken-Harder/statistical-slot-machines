import { machineData, totalPulls } from './slotMachine.js';
import { Distributions } from './distributions.js';

let regretChart = null;
let machineConfigs = [];
let userCumulativeRegret = 0;
let optimalCumulativeRegret = 0;
let bestMachineIndex = -1;

// Function to reset/destroy the regret chart
function resetRegretChart() {
    if (regretChart) {
        // Destroy the existing chart to prevent memory leaks
        regretChart.destroy();
        regretChart = null;
    }
    
    // Reset data
    userCumulativeRegret = 0;
    optimalCumulativeRegret = 0;
    bestMachineIndex = -1;
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
    const OPTIMAL_COLOR = '#21918c'; // Teal
    
    // Create datasets for user and optimal strategy regret with updated colors
    const datasets = [
        {
            label: 'Your Cumulative Regret',
            data: [0],
            borderColor: YOUR_COLOR,
            backgroundColor: `${YOUR_COLOR}20`, // 20 is hex for 12% opacity
            fill: false,
            borderWidth: 3,
            tension: 0.1
        },
        {
            label: 'Optimal Strategy Regret',
            data: [0],
            borderColor: OPTIMAL_COLOR,
            backgroundColor: `${OPTIMAL_COLOR}20`,
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
                position: 'top'
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
        }
    });
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

// Update the regret chart after each pull
function updateRegretChart(machinePulled, optimalMachineId) {
    if (!regretChart || bestMachineIndex === -1) return;
    
    // Get the best machine's expected value
    const bestMachine = machineConfigs[bestMachineIndex];
    const bestEV = getExpectedValue(bestMachine);
    
    // Get pulled machine's expected value
    const pulledMachine = machineConfigs.find(m => m.id === parseInt(machinePulled));
    const pulledEV = getExpectedValue(pulledMachine);
    
    // Get optimal machine's expected value
    const optimalMachine = machineConfigs.find(m => m.id === optimalMachineId);
    const optimalEV = getExpectedValue(optimalMachine);
    
    // Calculate regret (difference between best possible EV and chosen machine's EV)
    // Using expected values ensures consistency in regret calculation
    const userRegret = Math.max(0, bestEV - pulledEV);
    const optimalRegret = Math.max(0, bestEV - optimalEV);
    
    // Accumulate regret
    userCumulativeRegret += userRegret;
    optimalCumulativeRegret += optimalRegret;
    
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
    
    // Update optimal strategy regret dataset (index 1)
    regretChart.data.datasets[1].data.push(optimalCumulativeRegret);
    
    // Keep only the last maxDataPoints
    if (regretChart.data.datasets[1].data.length > maxDataPoints) {
        regretChart.data.datasets[1].data = regretChart.data.datasets[1].data.slice(-maxDataPoints);
    }
    
    // Only update the visual chart if it's visible
    const regretChartContainer = document.getElementById('regret-chart-container');
    if (!regretChartContainer.classList.contains('hidden')) {
        regretChart.update();
    }
    
    // Log regret for debugging
    console.log(`Pull ${totalPulls} Regret - User: ${userRegret.toFixed(2)} (Total: ${userCumulativeRegret.toFixed(2)}), Optimal: ${optimalRegret.toFixed(2)} (Total: ${optimalCumulativeRegret.toFixed(2)})`);
}

export { initializeRegretChart, updateRegretChart, resetRegretChart };
