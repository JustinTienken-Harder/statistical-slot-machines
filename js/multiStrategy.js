import { StrategyFactory } from './strategies/Strategy.js';
import { Distributions } from './distributions.js';

/**
 * Class to manage multiple strategies simultaneously
 */
export class MultiStrategyManager {
    constructor() {
        // Active strategies
        this.strategies = {};
        
        // Strategy metadata with color coding
        this.strategyMeta = {
            'ucb': { 
                name: 'UCB', 
                color: '#4285F4',
                fullName: 'Upper Confidence Bound'
            },
            'ns-ucb': { 
                name: 'Non-Stationary UCB', 
                color: '#34A853',
                fullName: 'Non-Stationary UCB'
            },
            'abtest': { 
                name: 'A/B Testing', 
                color: '#FBBC05',
                fullName: 'A/B/C Testing'
            },
            'exp3': { 
                name: 'EXP3', 
                color: '#EA4335',
                fullName: 'EXP3 (Adversarial)'
            },
            'exp3r': { 
                name: 'EXP3-R', 
                color: '#8F44AD',
                fullName: 'EXP3-R (Adaptive)'
            }
        };
        
        // Selected strategy types - start with UCB as default
        this.selectedTypes = ['ucb'];
        
        // Strategy options
        this.strategyOptions = {
            'ucb': {},
            'ns-ucb': {
                windowSize: 20,
                changeDetectionThreshold: 50
            },
            'abtest': {
                samplesPerMachine: 10
            },
            'exp3': {
                gamma: 0.1,
                eta: 0.1
            },
            'exp3r': {
                gamma: 0.1,
                eta: 0.1,
                windowSize: 20,
                thresholdMultiplier: 2.0
            }
        };
    }
    
    /**
     * Initialize with machine configurations
     * @param {Array} machineConfigs - Machine configurations
     */
    async initialize(machineConfigs) {
        this.machineConfigs = machineConfigs;
        
        // Clear existing strategies
        this.strategies = {};
        
        // Initialize each selected strategy
        for (const type of this.selectedTypes) {
            try {
                const strategy = await StrategyFactory.createStrategy(
                    type, 
                    machineConfigs, 
                    this.strategyOptions[type]
                );
                this.strategies[type] = strategy;
                console.log(`Initialized strategy: ${type}`);
            } catch (error) {
                console.error(`Failed to initialize strategy ${type}:`, error);
            }
        }
        
        // Generate legend
        this.updateLegend();
        
        return this;
    }
    
    /**
     * Update all strategies with a pull result
     * @param {number} machineId - The pulled machine ID
     * @param {number} payout - The payout received
     */
    update(machineId, payout) {
        // This method should NOT directly update strategies with user pulls
        
        // Instead, for each strategy:
        // 1. Get its recommendation (which machine it would have chosen)
        // 2. Simulate a pull for that recommended machine
        // 3. Update the strategy with the simulated result
        
        for (const type in this.strategies) {
            if (!this.isStrategySelected(type)) continue;
            
            // Get the current recommendation from this strategy
            const strategy = this.strategies[type];
            const recommendedMachineId = strategy.selectMachine();
            
            // Simulate a pull for the recommended machine
            const machineConfig = this.machineConfigs.find(c => c.id === recommendedMachineId);
            if (machineConfig) {
                // Get the current configuration (which might have been swapped in Hard Mode)
                const currentConfig = getCurrentMachineConfig(recommendedMachineId);
                
                // Sample from the distribution for this machine
                const simulatedPayout = Distributions.sample(
                    currentConfig.distribution, 
                    currentConfig.parameters
                );
                
                // Update the strategy with its own choice and result
                strategy.update(recommendedMachineId, simulatedPayout);
                
                console.log(`Strategy ${type} chose machine ${recommendedMachineId+1}, got payout ${simulatedPayout.toFixed(2)}`);
            }
        }
        
        // After updating all strategies, recalculate recommendations
        this.calculateRecommendations();
    }
    
    /**
     * Update all strategies with all payouts from a round
     * @param {Object} roundPayouts - Map of machine IDs to payouts
     */
    simulateStrategiesWithPayouts(roundPayouts) {
        for (const type in this.strategies) {
            //if (!this.isStrategySelected(type)) continue;
            
            // Get the machine this strategy would choose
            const strategy = this.strategies[type];
            const recommendedMachineId = strategy.selectMachine();
            
            // Use the pre-generated payout for this machine
            if (roundPayouts[recommendedMachineId] !== undefined) {
                const simulatedPayout = roundPayouts[recommendedMachineId];
                
                // Update the strategy with its own choice and the corresponding payout
                strategy.update(recommendedMachineId, simulatedPayout);
                
                console.log(`Strategy ${type} chose machine ${recommendedMachineId+1}, got payout ${simulatedPayout.toFixed(2)}`);
            } else {
                console.error(`No payout found for machine ${recommendedMachineId} chosen by strategy ${type}`);
            }
        }
    }
    
    /**
     * Get recommendations from all strategies
     * @returns {Object} Map of strategy type to recommended machine ID
     */
    getRecommendations() {
        const recommendations = {};
        
        for (const type in this.strategies) {
            recommendations[type] = this.strategies[type].selectMachine();
        }
        
        return recommendations;
    }
    
    /**
     * Get a specific strategy instance
     * @param {string} type - Strategy type
     * @returns {Strategy} The strategy instance or null
     */
    getStrategy(type) {
        return this.strategies[type] || null;
    }
    
    /**
     * Reset all strategies
     */
    reset() {
        for (const type in this.strategies) {
            this.strategies[type].reset();
        }
    }
    
    /**
     * Update which strategies are selected
     * @param {Array} selectedTypes - Array of strategy type identifiers
     */
    async updateSelectedStrategies(selectedTypes) {
        // Don't do anything if selection is empty
        if (!selectedTypes || selectedTypes.length === 0) {
            console.warn("No strategies selected, keeping current selection");
            return;
        }
        
        // Update selection
        this.selectedTypes = selectedTypes;
        
        // If we have machine configs, reinitialize
        if (this.machineConfigs) {
            await this.initialize(this.machineConfigs);
        }
    }
    
    /**
     * Update options for a specific strategy
     * @param {string} type - Strategy type
     * @param {Object} options - Strategy options
     */
    updateStrategyOptions(type, options) {
        if (this.strategyOptions[type]) {
            this.strategyOptions[type] = { ...this.strategyOptions[type], ...options };
            console.log(`Updated options for ${type}:`, this.strategyOptions[type]);
        }
    }
    
    /**
     * Generate HTML for the strategy legend
     */
    updateLegend() {
        const legendElement = document.getElementById('strategy-legend');
        if (!legendElement) return;
        
        let legendHTML = `
            <div class="legend-item">
                <div class="legend-color color-user"></div>
                <div class="legend-text">Your Pulls</div>
            </div>
            <div class="legend-item">
                <div class="legend-color color-best"></div>
                <div class="legend-text">Best Possible</div>
            </div>
        `;
        
        // Add each active strategy to the legend
        for (const type of this.selectedTypes) {
            if (this.strategyMeta[type]) {
                const meta = this.strategyMeta[type];
                legendHTML += `
                    <div class="legend-item">
                        <div class="legend-color" style="background-color: ${meta.color}"></div>
                        <div class="legend-text">${meta.name}</div>
                    </div>
                `;
            }
        }
        
        legendElement.innerHTML = legendHTML;
        legendElement.style.display = this.selectedTypes.length > 0 ? 'flex' : 'none';
    }
    
    /**
     * Handle notification of permutation for strategies that support it
     * @param {Array} newConfigs - The new machine configurations after permutation
     */
    handlePermutation(newConfigs) {
        for (const type in this.strategies) {
            if (!this.isStrategySelected(type)) continue;
            
            const strategy = this.strategies[type];
            if (typeof strategy.handlePermutation === 'function') {
                strategy.handlePermutation(newConfigs);
                console.log(`Notified ${type} strategy of permutation`);
            }
        }
    }
    
    /**
     * Get available strategies and their metadata
     * @returns {Object} Strategy metadata
     */
    getStrategyMeta() {
        return this.strategyMeta;
    }
    
    /**
     * Get currently selected strategy types
     * @returns {Array} Selected strategy types
     */
    getSelectedTypes() {
        return this.selectedTypes;
    }

    /**
     * Debug method to check sidebar functionality
     */
    testSidebarToggle() {
        const sidebar = document.getElementById('strategy-sidebar');
        const toggle = document.getElementById('sidebar-toggle');
        
        console.log('Sidebar elements found:', {
            sidebar: !!sidebar,
            toggle: !!toggle
        });
        
        if (sidebar) {
            const currentState = sidebar.classList.contains('open') ? 'open' : 'closed';
            console.log('Current sidebar state:', currentState);
            console.log('Sidebar styles:', {
                right: getComputedStyle(sidebar).right,
                visibility: getComputedStyle(sidebar).visibility,
                display: getComputedStyle(sidebar).display,
                width: getComputedStyle(sidebar).width,
                zIndex: getComputedStyle(sidebar).zIndex
            });
        }
        
        return {sidebar, toggle};
    }
}
