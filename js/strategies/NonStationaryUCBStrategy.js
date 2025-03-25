import { Strategy } from './Strategy.js';

/**
 * Non-Stationary UCB strategy that can adapt to changing distributions.
 * Uses a combination of sliding window and change detection to handle non-stationarity.
 */
export class NonStationaryUCBStrategy extends Strategy {
    /**
     * Initialize the Non-Stationary UCB strategy
     * @param {Array} machineConfigs - Array of machine configurations
     * @param {Object} options - Strategy options
     * @param {number} options.windowSize - Size of sliding window for observations (default: 20)
     * @param {number} options.discountFactor - Discount factor for older rewards (default: 0.9)
     * @param {number} options.changeDetectionThreshold - Page-Hinkley threshold for change detection (default: 50)
     */
    initialize(machineConfigs, options = {}) {
        this.totalPulls = 0;
        
        // Set up adaptive parameters with defaults
        this.windowSize = options.windowSize || 20; // Consider last N observations
        this.discountFactor = options.discountFactor || 0.9; // Weight for older rewards
        this.changeDetectionThreshold = options.changeDetectionThreshold || 50;
        
        // Initialize machine estimates with more tracking for non-stationarity
        this.machineEstimates = machineConfigs.map(config => ({
            id: config.id,
            pulls: 0,
            totalPayout: 0,
            mean: 0,
            ucb: Infinity,
            recentPayouts: [], // Track recent payouts for sliding window
            sumDeviations: 0, // For Page-Hinkley change detection
            minSumDeviations: 0,
            lastChangePoint: 0, // Track when distribution changed
            changeDetected: false
        }));
        
        console.log(`Non-Stationary UCB Strategy initialized with ${machineConfigs.length} machines`);
        console.log(`Parameters: windowSize=${this.windowSize}, discountFactor=${this.discountFactor}, changeDetectionThreshold=${this.changeDetectionThreshold}`);
    }
    
    /**
     * Select the best machine according to Non-Stationary UCB
     * @returns {number} The selected machine ID
     */
    selectMachine() {
        let bestMachineId = 0;
        let bestUCB = -Infinity;
        
        this.machineEstimates.forEach(machine => {
            // Skip update if no pulls
            if (machine.pulls === 0) {
                machine.ucb = Infinity; // Unexplored machines have infinite potential
                
                if (bestUCB < Infinity) {
                    bestUCB = Infinity;
                    bestMachineId = machine.id;
                }
                return;
            }
            
            // Get sliding window mean if we have enough data
            let effectiveMean = machine.mean;
            if (machine.recentPayouts.length > 0) {
                // Use adaptive sliding window based on when last change was detected
                if (machine.changeDetected) {
                    // Compute mean only from payouts after the change point
                    const recentPayoutsAfterChange = machine.recentPayouts.slice(
                        Math.max(0, machine.recentPayouts.length - (machine.pulls - machine.lastChangePoint))
                    );
                    if (recentPayoutsAfterChange.length > 0) {
                        effectiveMean = recentPayoutsAfterChange.reduce((sum, val) => sum + val, 0) 
                            / recentPayoutsAfterChange.length;
                    }
                } else {
                    // Use full sliding window for mean calculation
                    effectiveMean = machine.recentPayouts.reduce((sum, val) => sum + val, 0) 
                        / machine.recentPayouts.length;
                }
            }
            
            // Calculate adaptive exploration term based on change detection
            let effectivePulls = machine.pulls;
            if (machine.changeDetected) {
                // If change detected, reduce effective pulls to increase exploration
                effectivePulls = Math.max(1, machine.pulls - machine.lastChangePoint);
            }
            
            // Calculate modified UCB with dynamic exploration component
            // Use higher exploration coefficient after change detection (3 instead of 2)
            const explorationCoef = machine.changeDetected ? 3 : 2;
            const exploration = Math.sqrt(explorationCoef * Math.log(this.totalPulls) / effectivePulls);
            machine.ucb = effectiveMean + exploration;
            
            // Update best machine
            if (machine.ucb > bestUCB) {
                bestUCB = machine.ucb;
                bestMachineId = machine.id;
            }
        });
        
        return bestMachineId;
    }
    
    /**
     * Update the Non-Stationary UCB strategy with the results of a pull
     * @param {number} machineId - The ID of the pulled machine
     * @param {number} payout - The payout received
     */
    update(machineId, payout) {
        this.totalPulls++;
        
        // Find the machine in our estimates
        const machine = this.machineEstimates.find(m => m.id === machineId);
        if (!machine) {
            console.error("Machine not found in Non-Stationary UCB strategy:", machineId);
            return;
        }
        
        // Update machine statistics
        machine.pulls++;
        machine.totalPayout += payout;
        
        // Calculate previous mean before this pull
        const oldMean = machine.mean;
        machine.mean = machine.totalPayout / machine.pulls;
        
        // Update sliding window with the new payout
        machine.recentPayouts.push(payout);
        if (machine.recentPayouts.length > this.windowSize) {
            machine.recentPayouts.shift(); // Remove oldest observation
        }
        
        // Update Page-Hinkley change detection statistic
        const deviation = payout - oldMean - 0.05; // Small positive drift to prevent false alarms
        machine.sumDeviations = Math.max(0, machine.sumDeviations + deviation);
        machine.minSumDeviations = Math.min(machine.minSumDeviations, machine.sumDeviations);
        
        // Check if significant distribution change is detected
        const PHStat = machine.sumDeviations - machine.minSumDeviations;
        
        // Only check for changes after we have enough samples to establish a baseline
        if (machine.pulls > 5 && PHStat > this.changeDetectionThreshold) {
            console.log(`[Non-Stationary UCB] Change detected in machine ${machineId+1}: PH statistic = ${PHStat.toFixed(2)}`);
            
            // Record that a change was detected
            machine.changeDetected = true;
            machine.lastChangePoint = machine.pulls;
            
            // Reset change detection statistics
            machine.sumDeviations = 0;
            machine.minSumDeviations = 0;
            
            // Don't reset recentPayouts to retain some history for mean estimation
        }
    }
    
    /**
     * Reset the Non-Stationary UCB strategy
     */
    reset() {
        this.totalPulls = 0;
        this.machineEstimates.forEach(machine => {
            machine.pulls = 0;
            machine.totalPayout = 0;
            machine.mean = 0;
            machine.ucb = Infinity;
            machine.recentPayouts = [];
            machine.sumDeviations = 0;
            machine.minSumDeviations = 0;
            machine.lastChangePoint = 0;
            machine.changeDetected = false;
        });
    }
    
    /**
     * Get the Non-Stationary UCB strategy state
     * @returns {Object} The current state
     */
    getState() {
        return {
            totalPulls: this.totalPulls,
            machines: this.machineEstimates.map(m => ({
                id: m.id,
                pulls: m.pulls,
                mean: m.mean,
                ucb: m.ucb,
                recentMean: m.recentPayouts.length ? 
                    m.recentPayouts.reduce((sum, val) => sum + val, 0) / m.recentPayouts.length : 0,
                changeDetected: m.changeDetected,
                timeSinceChange: m.changeDetected ? m.pulls - m.lastChangePoint : 0
            }))
        };
    }
}
