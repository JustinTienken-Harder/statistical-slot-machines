/**
 * Strategy Interface - Base class for all bandit strategies
 */
export class Strategy {
    /**
     * Initialize the strategy with machine configurations
     * @param {Array} machineConfigs - Array of machine configurations
     */
    initialize(machineConfigs) {
        throw new Error("Strategy.initialize() must be implemented by subclass");
    }
    
    /**
     * Select the best machine according to this strategy
     * @returns {number} The selected machine ID
     */
    selectMachine() {
        throw new Error("Strategy.selectMachine() must be implemented by subclass");
    }
    
    /**
     * Update the strategy with the results of a pull
     * @param {number} machineId - The ID of the pulled machine
     * @param {number} payout - The payout received
     */
    update(machineId, payout) {
        throw new Error("Strategy.update() must be implemented by subclass");
    }
    
    /**
     * Reset the strategy state
     */
    reset() {
        throw new Error("Strategy.reset() must be implemented by subclass");
    }
    
    /**
     * Get the strategy state for reporting or visualization
     * @returns {Object} The current state
     */
    getState() {
        throw new Error("Strategy.getState() must be implemented by subclass");
    }
}

/**
 * Factory for creating strategy instances
 */
export class StrategyFactory {
    /**
     * Create a strategy of the specified type
     * @param {string} type - Strategy type identifier
     * @param {Array} machineConfigs - Array of machine configurations
     * @param {Object} options - Strategy options
     * @returns {Strategy} A strategy instance
     */
    static createStrategy(type, machineConfigs, options = {}) {
        // Import strategies dynamically to avoid circular dependencies
        switch (type) {
            case 'ucb':
                // Dynamic import for UCB strategy
                return import('./UCBStrategy.js').then(module => {
                    // Check if we're accessing the constructor correctly
                    if (!module.UCBStrategy) {
                        console.error('UCBStrategy not found in imported module:', module);
                        throw new Error('UCBStrategy not found in module');
                    }
                    const strategy = new module.UCBStrategy();
                    strategy.initialize(machineConfigs, options);
                    return strategy;
                });
                
            case 'abtest':
                // Dynamic import for A/B Test strategy with debugging
                return import('./ABTestStrategy.js').then(module => {
                    console.log('Imported ABTest module:', module);
                    // Check if we're accessing the constructor correctly
                    if (!module.ABTestStrategy) {
                        console.error('ABTestStrategy not found in imported module:', module);
                        throw new Error('ABTestStrategy not found in module');
                    }
                    const strategy = new module.ABTestStrategy();
                    strategy.initialize(machineConfigs, options);
                    return strategy;
                });
                
            default:
                throw new Error(`Unknown strategy type: ${type}`);
        }
    }
}
