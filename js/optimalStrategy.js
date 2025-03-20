export default OptimalStrategy;

function OptimalStrategy(slotMachines) {
    this.slotMachines = slotMachines;
    this.totalPayout = 0;
    this.totalPlays = 0;
    this.optimalMachineIndex = 0;
}

OptimalStrategy.prototype.sampleFromMachines = function(numSamples) {
    for (let i = 0; i < numSamples; i++) {
        const machineIndex = this.selectMachine();
        const payout = this.slotMachines[machineIndex].spin();
        this.totalPayout += payout;
        this.totalPlays++;
        this.updateOptimalMachine(machineIndex);
    }
};

OptimalStrategy.prototype.selectMachine = function() {
    // Implement a strategy to select a machine based on past performance
    // For simplicity, we can use a random selection for now
    return Math.floor(Math.random() * this.slotMachines.length);
};

OptimalStrategy.prototype.updateOptimalMachine = function(machineIndex) {
    // Logic to update the optimal machine based on performance
    // This could be based on the highest average payout or other criteria
    if (this.slotMachines[machineIndex].averagePayout > this.slotMachines[this.optimalMachineIndex].averagePayout) {
        this.optimalMachineIndex = machineIndex;
    }
};

OptimalStrategy.prototype.getTotalPayout = function() {
    return this.totalPayout;
};

OptimalStrategy.prototype.getOptimalMachineIndex = function() {
    return this.optimalMachineIndex;
};

// Implements an optimal strategy for multi-armed bandit problem

let optimalMachineEstimates = [];

function initializeOptimalStrategy(configs) {
    // Initialize estimates for each machine
    optimalMachineEstimates = configs.map(config => ({
        id: config.id,
        pulls: 0,
        totalPayout: 0,
        mean: 0,
        ucb: Infinity // Upper Confidence Bound
    }));
}

function getOptimalStrategyPayout() {
    // If no pulls have been made yet, return 0
    if (totalPulls === 0) return 0;
    
    // Find machine with highest UCB
    let bestMachineId = 0;
    let bestUCB = -Infinity;
    
    optimalMachineEstimates.forEach((machine, index) => {
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
    
    // Simulate pulling the lever of the best machine
    const bestMachine = machineConfigs.find(config => config.id === bestMachineId);
    const payout = Distributions.sample(bestMachine.distribution, bestMachine.parameters);
    
    // Update estimates for the selected machine
    const machineEstimate = optimalMachineEstimates.find(m => m.id === bestMachineId);
    machineEstimate.pulls++;
    machineEstimate.totalPayout += Math.max(0, payout);
    machineEstimate.mean = machineEstimate.totalPayout / machineEstimate.pulls;
    
    // Calculate overall optimal strategy performance
    let totalOptimalPayouts = 0;
    let totalOptimalPulls = 0;
    
    optimalMachineEstimates.forEach(machine => {
        totalOptimalPayouts += machine.totalPayout;
        totalOptimalPulls += machine.pulls;
    });
    
    return totalOptimalPulls > 0 ? totalOptimalPayouts / totalOptimalPulls : 0;
}