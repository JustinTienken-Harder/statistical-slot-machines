import { Strategy } from './Strategy.js';

/**
 * EXP3-R Strategy: Adaptation of EXP3 for non-stationary environments
 * Includes reset mechanisms to adapt to changing reward distributions
 */
export class EXP3RStrategy extends Strategy {
    /**
     * Initialize the EXP3-R strategy
     * @param {Array} machineConfigs - Array of machine configurations
     * @param {Object} options - Strategy options
     * @param {number} options.gamma - Exploration parameter (default: 0.1)
     * @param {number} options.eta - Learning rate (default: 0.1)
     * @param {number} options.windowSize - Size of sliding window for drift detection (default: 20)
     * @param {number} options.thresholdMultiplier - Threshold for detecting distribution changes (default: 2.0)
     */
    initialize(machineConfigs, options = {}) {
        this.numMachines = machineConfigs.length;
        this.totalPulls = 0;
        
        // Set exploration parameter (gamma)
        this.gamma = options.gamma !== undefined ? options.gamma : 0.1;
        
        // Set learning rate (eta)
        this.eta = options.eta !== undefined ? options.eta : 0.1;
        
        // Set window size for change detection
        this.windowSize = options.windowSize || 20;
        
        // Set threshold multiplier for change detection
        this.thresholdMultiplier = options.thresholdMultiplier || 2.0;
        
        // Initialize weights for each machine
        this.weights = Array(this.numMachines).fill(1.0);
        
        // Initialize probabilities
        this.updateProbabilities();
        
        // Change detection mechanism
        this.rewardWindows = Array(this.numMachines).fill().map(() => []);
        this.rewardVariances = Array(this.numMachines).fill(0);
        this.lastResets = Array(this.numMachines).fill(0);
        
        // Initialize tracking for each machine
        this.machineEstimates = machineConfigs.map((config, index) => ({
            id: config.id,
            pulls: 0,
            totalPayout: 0,
            mean: 0,
            probability: this.probabilities[index],
            weight: this.weights[index],
            recentPayouts: [],
            changeDetected: false,
            lastReset: 0
        }));
        
        console.log(`EXP3-R Strategy initialized with ${this.numMachines} machines`);
        console.log(`Parameters: gamma=${this.gamma}, eta=${this.eta}, windowSize=${this.windowSize}, thresholdMultiplier=${this.thresholdMultiplier}`);
    }
    
    /**
     * Update probability distribution based on weights
     * Mixture of uniform and weight-based probability
     */
    updateProbabilities() {
        // Calculate sum of weights
        const totalWeight = this.weights.reduce((a, b) => a + b, 0);
        
        // Update probabilities using the EXP3 formula
        this.probabilities = this.weights.map(weight => 
            (1 - this.gamma) * (weight / totalWeight) + (this.gamma / this.numMachines)
        );
        
        // Update machine estimates with new probabilities
        if (this.machineEstimates) {
            this.machineEstimates.forEach((machine, i) => {
                machine.probability = this.probabilities[i];
                machine.weight = this.weights[i];
            });
        }
    }
    
    /**
     * Select a machine based on probability distribution
     * @returns {number} The selected machine ID
     */
    selectMachine() {
        // Draw a random number
        const rand = Math.random();
        
        // Choose machine based on probability distribution
        let cumulativeProbability = 0;
        
        for (let i = 0; i < this.numMachines; i++) {
            cumulativeProbability += this.probabilities[i];
            if (rand < cumulativeProbability) {
                return this.machineEstimates[i].id;
            }
        }
        
        // Fallback to last machine (should rarely happen due to rounding errors)
        return this.machineEstimates[this.numMachines - 1].id;
    }
    
    /**
     * Detect changes in the reward distribution
     * @param {number} machineIndex - Index of the machine
     * @param {number} payout - New payout
     * @returns {boolean} Whether a change was detected
     */
    detectChange(machineIndex, payout) {
        const machine = this.machineEstimates[machineIndex];
        const window = this.rewardWindows[machineIndex];
        
        // Add the new payout to the window
        window.push(payout);
        machine.recentPayouts.push(payout);
        
        // Keep window size limited
        if (window.length > this.windowSize) {
            window.shift();
            machine.recentPayouts.shift();
        }
        
        // Need at least a few samples to detect change
        if (window.length < 5) {
            return false;
        }
        
        // Compute current mean
        const currentMean = window.reduce((sum, val) => sum + val, 0) / window.length;
        
        // Compute variance
        const variance = window.reduce((sum, val) => sum + Math.pow(val - currentMean, 2), 0) / window.length;
        this.rewardVariances[machineIndex] = variance;
        
        // Detect change using a Page-Hinkley test variant
        // If the machine hasn't been pulled much, don't check for changes
        if (machine.pulls < 10) {
            return false;
        }
        
        // Avoid frequent resets
        if (this.totalPulls - this.lastResets[machineIndex] < 10) {
            return false;
        }
        
        // Check if the current mean deviates significantly from historical mean
        const stdDev = Math.sqrt(variance);
        const meanDiff = Math.abs(currentMean - machine.mean);
        
        // If the difference is more than threshold * standard deviation, it's likely a change
        const changeDetected = meanDiff > this.thresholdMultiplier * stdDev && stdDev > 0.01;
        
        if (changeDetected) {
            console.log(`EXP3-R: Change detected in machine ${machine.id+1}`);
            console.log(`Mean diff: ${meanDiff.toFixed(4)}, StdDev: ${stdDev.toFixed(4)}, Threshold: ${(this.thresholdMultiplier * stdDev).toFixed(4)}`);
            return true;
        }
        
        return false;
    }
    
    /**
     * Reset weights for a specific machine to adapt to distribution changes
     * @param {number} machineIndex - Index of the machine to reset
     */
    resetMachine(machineIndex) {
        // Reset weight to initial value for this machine
        this.weights[machineIndex] = 1.0;
        
        // Mark the reset time
        this.lastResets[machineIndex] = this.totalPulls;
        this.machineEstimates[machineIndex].lastReset = this.totalPulls;
        this.machineEstimates[machineIndex].changeDetected = true;
        
        // Clear reward window for this machine
        this.rewardWindows[machineIndex] = [];
        
        // Update probabilities
        this.updateProbabilities();
        
        console.log(`EXP3-R: Reset weights for machine ${machineIndex}`);
    }
    
    /**
     * Implement a method to handle permutation notifications
     * @param {Array} newConfigs - The new machine configurations
     */
    handlePermutation(newConfigs) {
        console.log("EXP3-R strategy notified of distribution permutation");
        
        // Reset all weights when a permutation is detected
        this.weights = Array(this.numMachines).fill(1.0);
        this.rewardWindows = Array(this.numMachines).fill().map(() => []);
        this.lastResets = Array(this.numMachines).fill(this.totalPulls);
        
        // Mark all machines as having detected a change
        this.machineEstimates.forEach(machine => {
            machine.changeDetected = true;
            machine.lastReset = this.totalPulls;
            machine.recentPayouts = [];
        });
        
        // Update probabilities
        this.updateProbabilities();
    }
    
    /**
     * Update the EXP3-R strategy with the results of a pull
     * @param {number} machineId - The ID of the pulled machine
     * @param {number} payout - The payout received
     */
    update(machineId, payout) {
        this.totalPulls++;
        
        // Find the machine in our estimates
        const machineIndex = this.machineEstimates.findIndex(m => m.id === machineId);
        if (machineIndex === -1) {
            console.error("Machine not found in EXP3-R strategy:", machineId);
            return;
        }
        
        // Update machine statistics
        const machine = this.machineEstimates[machineIndex];
        machine.pulls++;
        machine.totalPayout += payout;
        machine.mean = machine.totalPayout / machine.pulls;
        
        // Detect changes in distribution
        if (this.detectChange(machineIndex, payout)) {
            // Reset the machine's weight if change detected
            this.resetMachine(machineIndex);
        } else {
            // Normalize payout to [0,1] range for use in the EXP3 algorithm
            // Assume payouts are in the range [-10, 10] for normalization
            const normalizedPayout = (payout + 10) / 20;
            
            // Calculate importance-weighted estimated reward
            // Only the chosen arm receives an update in EXP3
            const estimatedReward = normalizedPayout / machine.probability;
            
            // Update the weight of the pulled machine using exponential weighting
            this.weights[machineIndex] *= Math.exp(this.eta * estimatedReward / this.numMachines);
            
            // Recompute probabilities based on updated weights
            this.updateProbabilities();
            
            // Reset change detection flag after some time has passed
            if (machine.changeDetected && this.totalPulls - machine.lastReset > 30) {
                machine.changeDetected = false;
            }
        }
    }
    
    /**
     * Reset the EXP3-R strategy
     */
    reset() {
        this.totalPulls = 0;
        this.weights = Array(this.numMachines).fill(1.0);
        this.rewardWindows = Array(this.numMachines).fill().map(() => []);
        this.rewardVariances = Array(this.numMachines).fill(0);
        this.lastResets = Array(this.numMachines).fill(0);
        
        this.updateProbabilities();
        
        this.machineEstimates.forEach(machine => {
            machine.pulls = 0;
            machine.totalPayout = 0;
            machine.mean = 0;
            machine.probability = this.probabilities[this.machineEstimates.findIndex(m => m.id === machine.id)];
            machine.weight = this.weights[this.machineEstimates.findIndex(m => m.id === machine.id)];
            machine.recentPayouts = [];
            machine.changeDetected = false;
            machine.lastReset = 0;
        });
    }
    
    /**
     * Get the EXP3-R strategy state
     * @returns {Object} The current state
     */
    getState() {
        return {
            totalPulls: this.totalPulls,
            gamma: this.gamma,
            eta: this.eta,
            windowSize: this.windowSize,
            thresholdMultiplier: this.thresholdMultiplier,
            probabilities: this.probabilities,
            weights: this.weights,
            machines: this.machineEstimates.map(m => ({
                id: m.id,
                pulls: m.pulls,
                mean: m.mean,
                probability: m.probability.toFixed(4),
                weight: m.weight.toFixed(4),
                changeDetected: m.changeDetected,
                timeSinceReset: this.totalPulls - m.lastReset
            }))
        };
    }
}
