/**
 * Vidya Strategies - Multi-Timeframe Orderflow Delta & Absorption Engine
 * ZERO DUMMY VALUES. Uses real Binance multi-TF klines and volume metrics.
 */

const StrategyStrategies = {
    fetchLivePrice: async function(symbol) {
        let apiSymbol = symbol === 'XAUUSD' ? 'PAXGUSDT' : symbol;
        try {
            let res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${apiSymbol}`);
            let json = await res.json();
            return parseFloat(json.price);
        } catch(e) {
            return null;
        }
    },

    fetchMultiTFData: async function(symbol) {
        let apiSymbol = symbol === 'XAUUSD' ? 'PAXGUSDT' : symbol;
        const timeframes = ['1d', '4h', '1h', '15m', '5m', '1m'];
        let tfData = {};
        try {
            for (let tf of timeframes) {
                let limit = tf === '1m' ? 100 : tf === '5m' ? 60 : 30;
                let res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${apiSymbol}&interval=${tf}&limit=${limit}`);
                let data = await res.json();
                tfData[tf] = data.map(k => ({
                    time: k[0],
                    open: parseFloat(k[1]),
                    high: parseFloat(k[2]),
                    low: parseFloat(k[3]),
                    close: parseFloat(k[4]),
                    volume: parseFloat(k[5])
                }));
            }
            return tfData;
        } catch(e) {
            return null;
        }
    },

    calculateOrderflowDeltaAndAbsorption: function(m1Candles) {
        if (!m1Candles || m1Candles.length < 10) return { absorption: false, delta: 0 };
        
        let last = m1Candles[m1Candles.length - 1];
        let range = last.high - last.low;
        let body = Math.abs(last.close - last.open);
        
        let candleDelta = range > 0 ? ((last.close - last.open) / range) * last.volume : 0;
        let avgVol = m1Candles.reduce((acc, c) => acc + c.volume, 0) / m1Candles.length;
        
        // Absorption: High volume + Small price body (Big player accumulating)
        let isAbsorption = last.volume >= (avgVol * 1.8) && (body <= range * 0.35);

        return {
            delta: candleDelta,
            absorption: isAbsorption,
            volume: last.volume,
            price: last.close
        };
    }
};
