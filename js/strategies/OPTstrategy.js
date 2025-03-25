import { Strategy } from './Strategy';

export class OptimalPolicyStrategy extends Strategy {
    constructor(k, H, priors) {
        super();
        this.k = k; // Number of arms
        this.H = H; // Time horizon
        this.priors = priors; // Array of prior Beta distributions, e.g., [[alpha1, beta1], [alpha2, beta2], ...]
        this.OPT = [];
        this.values = [];
        this.counts = [];
        this.successes = [];
        this.failures = [];
    }

    /**
     * Initialize the strategy with machine configurations.
     * @param {Array} machineConfigs - Array of machine configurations.
     * Each config should contain an 'id' and prior Beta distribution parameters
     * e.g., [{ id: 0, prior: [1, 1] }, { id: 1, prior: [1, 1] }]
     */
    initialize(machineConfigs) {
        this.machinePriors = machineConfigs.map(config => ({
            id: config.id,
            prior: config.prior
        }));
        this.k = machineConfigs.length;
        this.counts = Array(this.k).fill(0);
        this.successes = Array(this.k).fill(0);
        this.failures = Array(this.k).fill(0);
        this.OPT = [];
        this.values = [];
        this.H = this.H || 1000; // Default time horizon if not provided
        this.computeOptimalPolicy();
    }

    /**
     * Computes the optimal policy using dynamic programming.
     */
    computeOptimalPolicy() {
        // Initialize the values array
        this.values = Array(this.H + 1).fill(null).map(() =>
            Array(1).fill(null).map(() => ({})) // Using 1 as a placeholder
        );
        this.OPT = Array(this.H + 1).fill(null).map(() =>
            Array(1).fill(null).map(() => ({}))  // Using 1 as a placeholder
        );

        // 1. Initialize for t = H (no more rewards)
        for (let armConfig of this.allArmConfigs(this.H)) {
            this.values[this.H][0][this.serializeArmConfig(armConfig)] = 0;
        }

        // Iterate backwards from t = H-1 down to t = 0
        for (let t = this.H - 1; t >= 0; t >= 0) {
            for (let armConfig of this.allArmConfigs(t)) {
                let bestValue = -1;
                let bestArm = -1;

                for (let arm = 0; arm < this.k; arm++) {
                    let configKey = this.serializeArmConfig(armConfig);
                    let successes = armConfig[arm].successes;
                    let failures = armConfig[arm].failures;
                    let prior = this.machinePriors.find(p => p.id === arm).prior; // Get prior from machineConfigs
                    let alpha = prior[0];
                    let beta = prior[1];

                    // Calculate expected value of pulling arm i (Vi(s, f))
                    let successProb = (alpha + successes) / (alpha + beta + successes + failures);

                    let valueSuccess = 0;
                    let nextArmConfigSuccess = this.nextArmConfig(armConfig, arm, true);
                    let nextConfigKeySuccess = this.serializeArmConfig(nextArmConfigSuccess);
                    if (this.values[t + 1][0][nextConfigKeySuccess] !== undefined) {
                        valueSuccess = this.values[t + 1][0][nextConfigKeySuccess];
                    }

                    let failureProb = (beta + failures) / (alpha + beta + successes + failures);
                    let valueFailure = 0;
                    let nextArmConfigFailure = this.nextArmConfig(armConfig, arm, false);
                    let nextConfigKeyFailure = this.serializeArmConfig(nextArmConfigFailure);
                    if (this.values[t + 1][0][nextConfigKeyFailure] !== undefined) {
                        valueFailure = this.values[t + 1][0][nextConfigKeyFailure];
                    }

                    let armValue = successProb * (1 + valueSuccess) + failureProb * (0 + valueFailure);

                    if (armValue > bestValue) {
                        bestValue = armValue;
                        bestArm = arm;
                    }
                }
                this.values[t][0][this.serializeArmConfig(armConfig)] = bestValue;
                this.OPT[t][0][this.serializeArmConfig(armConfig)] = bestArm;
            }
        }
    }

    /**
     * Select the best machine according to the optimal policy.
     * @returns {number} The selected machine ID
     */
    selectMachine() {
        let t = this.counts.reduce((a, b) => a + b, 0);
        let currentConfig = this.getCurrentArmConfig();
        let configKey = this.serializeArmConfig(currentConfig);
        return this.OPT[t][0][configKey];
    }

    /**
     * Update the strategy with the results of a pull.
     * @param {number} machineId - The ID of the pulled machine
     * @param {number} payout - The payout received (0 or 1)
     */
    update(machineId, payout) {
        this.counts[machineId]++;
        if (payout === 1) {
            this.successes[machineId]++;
        } else {
            this.failures[machineId]++;
        }
    }

    /**
     * Reset the strategy state
     */
    reset() {
        this.counts = Array(this.k).fill(0);
        this.successes = Array(this.k).fill(0);
        this.failures = Array(this.k).fill(0);
        this.OPT = [];
        this.values = [];
        this.computeOptimalPolicy(); // Recompute the optimal policy
    }

    /**
     * Get the strategy state for reporting or visualization
     * @returns {Object} The current state
     */
    getState() {
        return {
            counts: this.counts,
            successes: this.successes,
            failures: this.failures,
            OPT: this.OPT,
            values: this.values
        };
    }

    /**
     * Helper function to generate all possible arm configurations for a given time t.
     * @param {number} t - The current time step.
     * @returns {Array} An array of all possible arm configurations.
     */
    allArmConfigs(t) {
        let configs = [];
        let generateConfigs = (index, currentConfig, remainingPulls) => {
            if (index === this.k - 1) {
                currentConfig[index] = { successes: 0, failures: remainingPulls };
                configs.push(currentConfig.map(config => ({ ...config })));
                return;
            }

            for (let failures = 0; failures <= remainingPulls; failures++) {
                let successes = remainingPulls - failures;
                let newConfig = currentConfig.map(config => ({ ...config }));
                newConfig[index] = { successes: 0, failures: failures };
                generateConfigs(index + 1, newConfig, remainingPulls - failures);
            }
        };

        if (t >= 0) {
            generateConfigs(0, Array(this.k).fill({ successes: 0, failures: 0 }), t);
        }
        return configs;
    }

    /**
     * Helper function to serialize an arm configuration into a string key.
     * @param {Array} armConfig - The arm configuration.
     * @returns {string} The serialized key.
     */
    serializeArmConfig(armConfig) {
        let key = "";
        for (let i = 0; i < armConfig.length; i++) {
            key += armConfig[i].successes + "," + armConfig[i].failures + ";";
        }
        return key;
    }

    /**
     * Helper function to deserialize a key back into an arm configuration.
     * @param {string} key - The serialized key.
     * @returns {Array} The arm configuration.
     */
    deserializeArmConfig(key) {
        let armConfig = [];
        let pairs = key.split(";");
        for (let i = 0; i < pairs.length - 1; i++) {
            let values = pairs[i].split(",");
            armConfig.push({ successes: parseInt(values[0]), failures: parseInt(values[1]) });
        }
        return armConfig;
    }

    /**
     * Helper function to get the next arm configuration after a pull.
     * @param {Array} currentConfig - The current arm configuration.
     * @param {number} arm - The selected arm.
     * @param {boolean} success - Whether the pull was successful.
     * @returns {Array} The next arm configuration.
     */
    nextArmConfig(currentConfig, arm, success) {
        let nextConfig = currentConfig.map(config => ({ ...config }));
        if (success) {
            nextConfig[arm] = { successes: nextConfig[arm].successes + 1, failures: nextConfig[arm].failures };
        } else {
            nextConfig[arm] = { successes: nextConfig[arm].successes, failures: nextConfig[arm].failures + 1 };
        }
        return nextConfig;
    }

    /**
     * Helper function to get the current arm configuration based on counts.
     * @returns {Array} The current arm configuration.
     */
    getCurrentArmConfig() {
        let currentConfig = [];
        for (let i = 0; i < this.k; i++) {
            currentConfig.push({ successes: this.successes[i], failures: this.failures[i] });
        }
        return currentConfig;
    }
}