/**
 * Vidya Strategies - Magnet Level, Volume Delta & Orderflow Aggression Engine
 * ZERO Dummy Data. Pure Binance Klines & Dynamic Liquidity Calculations.
 */

const StrategyStrategies = {
    fetchLivePrice: async function(symbol) {
        let apiSymbol = symbol === 'XAUUSD' ? 'PAXGUSDT' : symbol;
        try {
            let res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${apiSymbol}`);
            let json = await res.json();
            return parseFloat(json.price);
        } catch(e) { return null; }
    },

    fetchMultiTFData: async function(symbol) {
        let apiSymbol = symbol === 'XAUUSD' ? 'PAXGUSDT' : symbol;
        const tfs = ['4h', '1h', '15m', '1m'];
        let result = {};
        try {
            for (let tf of tfs) {
                let limit = tf === '1m' ? 120 : 60;
                let res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${apiSymbol}&interval=${tf}&limit=${limit}`);
                let data = await res.json();
                result[tf] = data.map(k => ({
                    time: k[0],
                    open: parseFloat(k[1]),
                    high: parseFloat(k[2]),
                    low: parseFloat(k[3]),
                    close: parseFloat(k[4]),
                    volume: parseFloat(k[5])
                }));
            }
            return result;
        } catch(e) { return null; }
    },

    // Dynamic Magnet Level & Liquidity Pool Calculation
    calculateMagnetLevelsAndDelta: function(tfData) {
        if (!tfData || !tfData['1h'] || !tfData['1m']) return null;

        let h1 = tfData['1h'];
        let m1 = tfData['1m'];
        let latestM1 = m1[m1.length - 1];

        // 1. Magnet Price Levels (Highest Liquidity High/Low Zones)
        let highs = h1.map(c => c.high);
        let lows = h1.map(c => c.low);
        let magnetHigh = Math.max(...highs);
        let magnetLow = Math.min(...lows);

        // 2. Real Volume Delta Aggression Calculation
        let avgVol1m = m1.slice(-20).reduce((acc, c) => acc + c.volume, 0) / 20;
        let deltaVolume = (latestM1.close - latestM1.open) * latestM1.volume;
        let isVolumeAggressive = latestM1.volume >= (avgVol1m * 2.0);

        // 3. Orderflow Absorption Check
        let range = latestM1.high - latestM1.low;
        let body = Math.abs(latestM1.close - latestM1.open);
        let isAbsorption = isVolumeAggressive && (body <= (range * 0.4));

        return {
            price: latestM1.close,
            magnetHigh: magnetHigh,
            magnetLow: magnetLow,
            deltaVolume: deltaVolume,
            isAggressive: isVolumeAggressive,
            isAbsorption: isAbsorption
        };
    }
};
