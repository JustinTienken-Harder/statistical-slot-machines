import { StrategyFactory } from './strategies/Strategy.js';

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
        for (const type in this.strategies) {
            this.strategies[type].update(machineId, payout);
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
     */
    handlePermutation() {
        for (const type in this.strategies) {
            const strategy = this.strategies[type];
            if (typeof strategy.handlePermutation === 'function') {
                strategy.handlePermutation(this.machineConfigs);
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
}
