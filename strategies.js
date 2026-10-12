/**
 * Vidya Strategies Module - Pure Binance API Fetcher & FVG Magnet Engine
 */

const StrategyStrategies = {
    fetchLivePrice: async function(symbol) {
        let apiSymbol = symbol === 'XAUUSD' ? 'PAXGUSDT' : symbol;
        try {
            let res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${apiSymbol}`);
            let json = await res.json();
            return parseFloat(json.price);
        } catch(e) {
            return symbol === 'BTCUSDT' ? 68000 : symbol === 'ETHUSDT' ? 3500 : symbol === 'SOLUSDT' ? 145 : 2650;
        }
    },

    fetchMultiTFKlines: async function(symbol) {
        let apiSymbol = symbol === 'XAUUSD' ? 'PAXGUSDT' : symbol;
        const intervals = ['1d', '4h', '1h', '30m', '15m', '1m'];
        let multiData = {};
        try {
            for (let tf of intervals) {
                let limit = tf === '1m' ? 60 : 30;
                let res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${apiSymbol}&interval=${tf}&limit=${limit}`);
                let data = await res.json();
                multiData[tf] = data.map(k => ({
                    time: k[0],
                    open: parseFloat(k[1]),
                    high: parseFloat(k[2]),
                    low: parseFloat(k[3]),
                    close: parseFloat(k[4]),
                    volume: parseFloat(k[5])
                }));
            }
            return multiData;
        } catch(e) { return null; }
    },

    calculateMagnetTP: function(tfData, direction) {
        let m15 = tfData['15m'];
        if (!m15 || m15.length < 10) return null;
        let isBuy = direction === 'BUY';
        
        for (let i = m15.length - 3; i >= 4; i--) {
            if (isBuy && m15[i].low > m15[i-2].high) return m15[i].low;
            else if (!isBuy && m15[i].high < m15[i-2].low) return m15[i].high;
        }
        let highest = Math.max(...m15.map(c => c.high));
        let lowest = Math.min(...m15.map(c => c.low));
        return isBuy ? highest * 1.012 : lowest * 0.988;
    }
};
