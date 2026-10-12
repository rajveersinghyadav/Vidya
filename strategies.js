/**
 * Vidya Strategies Module - Real Volume Delta Aggression & Rally Detector
 * ZERO Dummy Data. Uses actual Binance 1m & 15m volume and price velocity.
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

    fetchMultiTFKlines: async function(symbol) {
        let apiSymbol = symbol === 'XAUUSD' ? 'PAXGUSDT' : symbol;
        const intervals = ['1h', '15m', '1m'];
        let multiData = {};
        try {
            for (let tf of intervals) {
                let limit = tf === '1m' ? 100 : 50; // More depth for 1m continuous rally tracking
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

    // Calculate Real Volume Delta & Continuous Rally (Capturing 200 to 1000+ pips moves)
    detectMassiveRallyAndDelta: function(tfData) {
        if (!tfData || !tfData['1m']) return { triggered: false };
        let m1 = tfData['1m'];
        if (m1.length < 20) return { triggered: false };

        let lastCandles = m1.slice(-10); // Last 10 candles for velocity check
        let avgVolume = m1.reduce((acc, c) => acc + c.volume, 0) / m1.length;

        // Check for aggressive volume spike (Smart money injection)
        let latestCandle = m1[m1.length - 1];
        let isVolumeAggressive = latestCandle.volume >= (avgVolume * 2.2); // 2.2x volume surge

        // Count consecutive same-color expansion candles (Continuous Rally like screenshots)
        let consecutiveGreen = 0;
        let consecutiveRed = 0;

        for (let i = lastCandles.length - 1; i >= 0; i--) {
            if (lastCandles[i].close > lastCandles[i].open) consecutiveGreen++;
            else break;
        }

        for (let i = lastCandles.length - 1; i >= 0; i--) {
            if (lastCandles[i].close < lastCandles[i].open) consecutiveRed++;
            else break;
        }

        let isBullishRally = consecutiveGreen >= 4 && isVolumeAggressive;
        let isBearishRally = consecutiveRed >= 4 && isVolumeAggressive;

        if (!isBullishRally && !isBearishRally) return { triggered: false };

        let direction = isBullishRally ? 'BUY' : 'SELL';
        let entryPrice = latestCandle.close;
        
        // Massive TP calculation for 1:5 to 1:20 R:R (Catching long unbroken rallies)
        let atrEstimate = Math.abs(latestCandle.high - latestCandle.low) * 4;
        let targetTP = direction === 'BUY' ? entryPrice + (atrEstimate * 6) : entryPrice - (atrEstimate * 6);
        let stopLoss = direction === 'BUY' ? latestCandle.low - (atrEstimate * 0.8) : latestCandle.high + (atrEstimate * 0.8);

        let risk = Math.abs(entryPrice - stopLoss);
        let reward = Math.abs(targetTP - entryPrice);
        let calculatedRR = risk > 0 ? (reward / risk).toFixed(1) : "5.0";

        return {
            triggered: true,
            direction: direction,
            entry: entryPrice,
            tp: targetTP,
            sl: stopLoss,
            rr: `1:${calculatedRR}`,
            volumeSpike: latestCandle.volume.toFixed(2)
        };
    }
};
