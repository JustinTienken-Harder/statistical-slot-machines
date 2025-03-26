import { Strategy } from './Strategy.js';

/**
 * EXP3 Strategy - Exponential-weight algorithm for Exploration and Exploitation
 * Designed for adversarial bandits with non-stochastic rewards
 */
export class EXP3Strategy extends Strategy {
    /**
     * Initialize the EXP3 strategy
     * @param {Array} machineConfigs - Array of machine configurations
     * @param {Object} options - Strategy options
     * @param {number} options.gamma - Exploration parameter (default: 0.1)
     * @param {number} options.eta - Learning rate (default: 0.1)
     */
    initialize(machineConfigs, options = {}) {
        this.numMachines = machineConfigs.length;
        this.totalPulls = 0;
        
        // Set exploration parameter (gamma)
        this.gamma = options.gamma !== undefined ? options.gamma : 0.1;
        
        // Set learning rate (eta)
        this.eta = options.eta !== undefined ? options.eta : 0.1;
        
        // Initialize weights for each machine
        this.weights = Array(this.numMachines).fill(1.0);
        
        // Initialize probabilities
        this.updateProbabilities();
        
        // Initialize tracking for each machine
        this.machineEstimates = machineConfigs.map((config, index) => ({
            id: config.id,
            pulls: 0,
            totalPayout: 0,
            mean: 0,
            probability: this.probabilities[index],
            weight: this.weights[index]
        }));
        
        console.log(`EXP3 Strategy initialized with ${this.numMachines} machines`);
        console.log(`Parameters: gamma=${this.gamma}, eta=${this.eta}`);
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
     * Update the EXP3 strategy with the results of a pull
     * @param {number} machineId - The ID of the pulled machine
     * @param {number} payout - The payout received
     */
    update(machineId, payout) {
        this.totalPulls++;
        
        // Find the machine in our estimates
        const machineIndex = this.machineEstimates.findIndex(m => m.id === machineId);
        if (machineIndex === -1) {
            console.error("Machine not found in EXP3 strategy:", machineId);
            return;
        }
        
        // Update machine statistics
        const machine = this.machineEstimates[machineIndex];
        machine.pulls++;
        machine.totalPayout += payout;
        machine.mean = machine.totalPayout / machine.pulls;
        
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
    }
    
    /**
     * Reset the EXP3 strategy
     */
    reset() {
        this.totalPulls = 0;
        this.weights = Array(this.numMachines).fill(1.0);
        
        this.updateProbabilities();
        
        this.machineEstimates.forEach(machine => {
            machine.pulls = 0;
            machine.totalPayout = 0;
            machine.mean = 0;
            machine.probability = this.probabilities[this.machineEstimates.findIndex(m => m.id === machine.id)];
            machine.weight = this.weights[this.machineEstimates.findIndex(m => m.id === machine.id)];
        });
    }
    
    /**
     * Get the EXP3 strategy state
     * @returns {Object} The current state
     */
    getState() {
        return {
            totalPulls: this.totalPulls,
            gamma: this.gamma,
            eta: this.eta,
            probabilities: this.probabilities,
            weights: this.weights,
            machines: this.machineEstimates.map(m => ({
                id: m.id,
                pulls: m.pulls,
                mean: m.mean,
                probability: m.probability.toFixed(4),
                weight: m.weight.toFixed(4)
            }))
        };
    }
}
