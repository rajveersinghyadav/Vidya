/**
 * Vidya Strategies Module
 * Pure Binance Klines & Real Liquidity Level Extraction
 * NO FAKE/DUMMY VALUES.
 */

const VidyaStrategies = {
    // Live Price Fetcher
    fetchLivePrice: async function(symbol) {
        let apiSymbol = symbol === 'XAUUSD' ? 'PAXGUSDT' : symbol;
        try {
            let res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${apiSymbol}`);
            let json = await res.json();
            return parseFloat(json.price);
        } catch(e) { return null; }
    },

    // Multi-Timeframe Data Fetcher (1D, 1H, 15m, 1m)
    fetchMultiTFData: async function(symbol) {
        let apiSymbol = symbol === 'XAUUSD' ? 'PAXGUSDT' : symbol;
        const timeframes = ['1d', '1h', '15m', '1m'];
        let result = {};
        try {
            for (let tf of timeframes) {
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

    // Dynamic Liquidity Labels Extractor (PDH, PDL, ASH, ASL)
    extractLiquidityLabels: function(tfData) {
        if (!tfData || !tfData['1d'] || !tfData['1h']) return null;

        let d1 = tfData['1d'];
        let h1 = tfData['1h'];

        // Previous Day High & Low
        let pdh = d1.length >= 2 ? d1[d1.length - 2].high : d1[0].high;
        let pdl = d1.length >= 2 ? d1[d1.length - 2].low : d1[0].low;

        // Asian Session High & Low (First 8 Hours of the Day in 1H data)
        let asianSlice = h1.slice(-24, -16);
        let ash = asianSlice.length > 0 ? Math.max(...asianSlice.map(c => c.high)) : Math.max(...h1.map(c => c.high));
        let asl = asianSlice.length > 0 ? Math.min(...asianSlice.map(c => c.low)) : Math.min(...h1.map(c => c.low));

        return { pdh, pdl, ash, asl };
    },

    // Orderflow Volume Delta & Absorption Check
    calculateOrderflowDelta: function(m1Candles) {
        if (!m1Candles || m1Candles.length < 15) return { delta: 0, isAbsorption: false };

        let last = m1Candles[m1Candles.length - 1];
        let avgVol = m1Candles.slice(-15).reduce((acc, c) => acc + c.volume, 0) / 15;

        let range = last.high - last.low;
        let body = Math.abs(last.close - last.open);

        let isSpike = last.volume >= (avgVol * 1.8);
        let isAbsorption = isSpike && (body <= range * 0.35); // Large volume, small candle body = Smart Money Absorption

        let delta = range > 0 ? ((last.close - last.open) / range) * last.volume : 0;

        return { delta, isAbsorption, isSpike, currentPrice: last.close };
    }
};
