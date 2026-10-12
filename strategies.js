/**
 * Vidya Strategies Module - Pure Binance Data & SMC Footprint Extractor
 * ZERO Dummy / Fake Data. Pure 6-Timeframe Data Fetching.
 */

const VidyaStrategies = {
    fetchLivePrice: async function(symbol) {
        let apiSymbol = symbol === 'XAUUSD' ? 'PAXGUSDT' : symbol;
        try {
            let res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${apiSymbol}`);
            let json = await res.json();
            return parseFloat(json.price);
        } catch(e) { return null; }
    },

    // Fetch 6 Timeframes Data from Binance
    fetch6TFData: async function(symbol) {
        let apiSymbol = symbol === 'XAUUSD' ? 'PAXGUSDT' : symbol;
        const timeframes = ['1d', '4h', '1h', '15m', '5m', '1m'];
        let result = {};
        try {
            for (let tf of timeframes) {
                let limit = (tf === '1m' || tf === '5m') ? 100 : 50;
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

    // Extract Liquidity Labels (PDH, PDL, ASH, ASL)
    extractSMCLabels: function(tfData) {
        if (!tfData || !tfData['1d'] || !tfData['1h']) return null;

        let d1 = tfData['1d'];
        let h1 = tfData['1h'];

        let pdh = d1.length >= 2 ? d1[d1.length - 2].high : d1[0].high;
        let pdl = d1.length >= 2 ? d1[d1.length - 2].low : d1[0].low;

        let asianSlice = h1.slice(-24, -16);
        let ash = asianSlice.length > 0 ? Math.max(...asianSlice.map(c => c.high)) : Math.max(...h1.map(c => c.high));
        let asl = asianSlice.length > 0 ? Math.min(...asianSlice.map(c => c.low)) : Math.min(...h1.map(c => c.low));

        return { pdh, pdl, ash, asl };
    },

    // Volume Delta & Institutional Absorption Calculation
    checkOrderflowAbsorption: function(m1Candles) {
        if (!m1Candles || m1Candles.length < 20) return { isSpike: false, isAbsorption: false };

        let last = m1Candles[m1Candles.length - 1];
        let avgVol = m1Candles.slice(-20).reduce((acc, c) => acc + c.volume, 0) / 20;

        let range = last.high - last.low;
        let body = Math.abs(last.close - last.open);

        let isSpike = last.volume >= (avgVol * 1.8);
        let isAbsorption = isSpike && (range > 0 ? (body / range) <= 0.40 : false);

        return { isSpike, isAbsorption, currentPrice: last.close, high: last.high, low: last.low };
    }
};
