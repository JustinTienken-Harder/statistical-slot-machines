// Distribution utility functions

const Distributions = {
    // Box-Muller transform for normal distribution
    normal: function(mean, stdDev) {
        let u = 0, v = 0;
        while(u === 0) u = Math.random();
        while(v === 0) v = Math.random();
        const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
        return mean + stdDev * z;
    },
    
    uniform: function(min, max) {
        return min + Math.random() * (max - min);
    },
    
    chiSquared: function(degreesOfFreedom) {
        let result = 0;
        for (let i = 0; i < degreesOfFreedom; i++) {
            // Sum of squares of standard normal variates
            const z = this.normal(0, 1);
            result += z * z;
        }
        return result;
    },
    
    exponential: function(rate) {
        return -Math.log(1 - Math.random()) / rate;
    },
    
    poisson: function(lambda) {
        const L = Math.exp(-lambda);
        let k = 0;
        let p = 1;
        
        do {
            k++;
            p *= Math.random();
        } while (p > L);
        
        return k - 1;
    },
    
    // Sample from a distribution based on type and parameters
    sample: function(type, params) {
        switch(type) {
            case 'normal':
                return this.normal(params[0], params[1]);
            case 'uniform':
                return this.uniform(params[0], params[1]);
            case 'chi-squared':
                return this.chiSquared(params[0]);
            case 'exponential':
                return this.exponential(params[0]);
            case 'poisson':
                return this.poisson(params[0]);
            default:
                return 0;
        }
    }
};

export { Distributions };
