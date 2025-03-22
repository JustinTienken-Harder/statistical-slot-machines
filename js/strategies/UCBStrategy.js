import { Strategy } from './Strategy.js';

/**
 * Upper Confidence Bound (UCB) strategy for multi-armed bandits
 */
export class UCBStrategy extends Strategy {
    /**
     * Initialize the UCB strategy
     * @param {Array} machineConfigs - Array of machine configurations
     */
    initialize(machineConfigs) {
        this.totalPulls = 0;
        this.machineEstimates = machineConfigs.map(config => ({
            id: config.id,
            pulls: 0,
            totalPayout: 0,
            mean: 0,
            ucb: Infinity // Upper Confidence Bound
        }));
        
        console.log("UCB Strategy initialized with", machineConfigs.length, "machines");
    }
    
    /**
     * Select the best machine according to UCB
     * @returns {number} The selected machine ID
     */
    selectMachine() {
        let bestMachineId = 0;
        let bestUCB = -Infinity;
        
        this.machineEstimates.forEach(machine => {
            // Update UCB for each machine
            if (machine.pulls > 0) {
                // UCB1 formula: mean + sqrt(2 * ln(totalPulls) / machine.pulls)
                const exploration = Math.sqrt(2 * Math.log(this.totalPulls) / machine.pulls);
                machine.ucb = machine.mean + exploration;
            } else {
                machine.ucb = Infinity; // Unexplored machines have infinite potential
            }
            
            if (machine.ucb > bestUCB) {
                bestUCB = machine.ucb;
                bestMachineId = machine.id;
            }
        });
        
        return bestMachineId;
    }
    
    /**
     * Update the UCB strategy with the results of a pull
     * @param {number} machineId - The ID of the pulled machine
     * @param {number} payout - The payout received
     */
    update(machineId, payout) {
        this.totalPulls++;
        
        // Find the machine in our estimates
        const machine = this.machineEstimates.find(m => m.id === machineId);
        if (!machine) {
            console.error("Machine not found in UCB strategy:", machineId);
            return;
        }
        
        // Update machine statistics
        machine.pulls++;
        machine.totalPayout += payout;
        machine.mean = machine.totalPayout / machine.pulls;
        
        // Update UCB for this machine
        if (machine.pulls > 0) {
            const exploration = Math.sqrt(2 * Math.log(this.totalPulls) / machine.pulls);
            machine.ucb = machine.mean + exploration;
        }
    }
    
    /**
     * Reset the UCB strategy
     */
    reset() {
        this.totalPulls = 0;
        this.machineEstimates.forEach(machine => {
            machine.pulls = 0;
            machine.totalPayout = 0;
            machine.mean = 0;
            machine.ucb = Infinity;
        });
    }
    
    /**
     * Get the UCB strategy state
     * @returns {Object} The current state
     */
    getState() {
        return {
            totalPulls: this.totalPulls,
            machines: this.machineEstimates.map(m => ({
                id: m.id,
                pulls: m.pulls,
                mean: m.mean,
                ucb: m.ucb
            }))
        };
    }
}
