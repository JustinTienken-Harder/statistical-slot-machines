import { Strategy } from './Strategy.js';

/**
 * A/B/C Testing strategy for multi-armed bandits
 * This strategy samples each machine equally for a fixed number of times,
 * then commits to the best-performing machine.
 */
// Export the class directly to match how StrategyFactory expects it
export class ABTestStrategy extends Strategy {
    /**
     * Initialize the A/B Test strategy
     * @param {Array} machineConfigs - Array of machine configurations
     * @param {Object} options - Strategy options
     * @param {number} options.samplesPerMachine - Number of samples per machine (default: 10)
     */
    initialize(machineConfigs, options = {}) {
        this.totalPulls = 0;
        this.explorationCompleted = false;
        this.bestMachineId = null;
        
        // Calculate appropriate sample size based on number of machines
        // Try to sample each machine at least 10 times, but adjust for more machines
        this.samplesPerMachine = options.samplesPerMachine || 
            Math.max(10, Math.min(30, Math.ceil(100 / machineConfigs.length)));
        
        this.explorationPhaseLength = machineConfigs.length * this.samplesPerMachine;
        
        // Initialize tracking for each machine
        this.machineEstimates = machineConfigs.map(config => ({
            id: config.id,
            pulls: 0,
            totalPayout: 0,
            mean: 0
        }));
        
        // Keep track of which machine should be pulled next during exploration
        this.currentExplorationIndex = 0;
        
        console.log(`A/B Test Strategy initialized with ${machineConfigs.length} machines`);
        console.log(`Sampling each machine ${this.samplesPerMachine} times (${this.explorationPhaseLength} total pulls)`);
    }
    
    /**
     * Select the best machine according to A/B Test strategy
     * @returns {number} The selected machine ID
     */
    selectMachine() {
        // If we're still in the exploration phase, cycle through the machines
        if (this.totalPulls < this.explorationPhaseLength) {
            const machineIndex = this.currentExplorationIndex % this.machineEstimates.length;
            const selectedMachine = this.machineEstimates[machineIndex];
            
            // Update the index for the next pull
            this.currentExplorationIndex++;
            
            return selectedMachine.id;
        }
        
        // If we just finished exploration, determine the best machine
        if (!this.explorationCompleted) {
            this._determineBestMachine();
            this.explorationCompleted = true;
        }
        
        // In exploitation phase, always return the best machine
        return this.bestMachineId;
    }
    
    /**
     * Update the A/B Test strategy with the results of a pull
     * @param {number} machineId - The ID of the pulled machine
     * @param {number} payout - The payout received
     */
    update(machineId, payout) {
        this.totalPulls++;
        
        // Find the machine in our estimates
        const machine = this.machineEstimates.find(m => m.id === machineId);
        if (!machine) {
            console.error("Machine not found in A/B Test strategy:", machineId);
            return;
        }
        
        // Update machine statistics
        machine.pulls++;
        machine.totalPayout += payout;
        machine.mean = machine.totalPayout / machine.pulls;
        
        // If we've just completed the exploration phase, determine the best machine
        if (this.totalPulls === this.explorationPhaseLength && !this.explorationCompleted) {
            this._determineBestMachine();
            this.explorationCompleted = true;
            
            console.log("A/B Test Strategy: Exploration phase complete");
            console.log("Machine statistics:", this.machineEstimates);
            console.log(`Best machine selected: Machine ${this.bestMachineId + 1} with average payout ${this.machineEstimates.find(m => m.id === this.bestMachineId).mean}`);
        }
    }
    
    /**
     * Determine the best machine based on average payout
     * @private
     */
    _determineBestMachine() {
        let bestMachine = this.machineEstimates[0];
        
        for (const machine of this.machineEstimates) {
            if (machine.mean > bestMachine.mean) {
                bestMachine = machine;
            }
        }
        
        this.bestMachineId = bestMachine.id;
    }
    
    /**
     * Reset the A/B Test strategy
     */
    reset() {
        this.totalPulls = 0;
        this.explorationCompleted = false;
        this.bestMachineId = null;
        this.currentExplorationIndex = 0;
        
        this.machineEstimates.forEach(machine => {
            machine.pulls = 0;
            machine.totalPayout = 0;
            machine.mean = 0;
        });
    }
    
    /**
     * Get the A/B Test strategy state
     * @returns {Object} The current state
     */
    getState() {
        return {
            totalPulls: this.totalPulls,
            explorationCompleted: this.explorationCompleted,
            samplesPerMachine: this.samplesPerMachine,
            bestMachineId: this.bestMachineId,
            machines: this.machineEstimates.map(m => ({
                id: m.id,
                pulls: m.pulls,
                mean: m.mean
            })),
            phase: this.explorationCompleted ? 'exploitation' : 'exploration',
            progress: Math.min(100, Math.floor((this.totalPulls / this.explorationPhaseLength) * 100))
        };
    }
}
