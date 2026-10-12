/**
 * Vidya Strategies & Calculator Engine
 * Calculates SMC Labels, Magnet Zones, Sweeps & Win-Rate Tool Combinations
 */

const VidyaStrategies = {
    
    // Calculate Important SMC & Magnetic Labels
    calculateSMCLabels: async function(symbol) {
        let d1 = await VidyaData.fetchKlines(symbol, '1d', 10);
        let h1 = await VidyaData.fetchKlines(symbol, '1h', 30);
        if (!d1 || !h1) return null;

        let pdh = d1.length >= 2 ? d1[d1.length - 2].high : d1[0].high;
        let pdl = d1.length >= 2 ? d1[d1.length - 2].low : d1[0].low;
        let asianSlice = h1.slice(-24, -16);
        let ash = asianSlice.length > 0 ? Math.max(...asianSlice.map(c => c.high)) : pdh;
        let asl = asianSlice.length > 0 ? Math.min(...asianSlice.map(c => c.low)) : pdl;

        return { pdh, pdl, ash, asl };
    },

    // Evaluate Strategy Combinations & Backtest Win Rate on the Fly
    runStrategyCalculator: async function(symbol) {
        let klines = await VidyaData.fetchKlines(symbol, '15m', 150);
        let labels = await this.calculateSMCLabels(symbol);
        if (!klines || !labels) return { winRate: 0, bestCombo: "Evaluating..." };

        let wins = 0, total = 0;

        for (let i = 20; i < klines.length - 10; i++) {
            let c = klines[i];
            let prevSlice = klines.slice(i - 15, i);
            let sHigh = Math.max(...prevSlice.map(x => x.high));
            let sLow = Math.min(...prevSlice.map(x => x.low));
            let avgVol = prevSlice.reduce((acc, x) => acc + x.volume, 0) / prevSlice.length;

            // 1. Liquidity Sweep Detection
            let isSweepLow = c.low < sLow && c.close > sLow;
            let isSweepHigh = c.high > sHigh && c.close < sHigh;

            // 2. Volume Imbalance / Spike
            let isImbalance = c.volume >= (avgVol * 1.5);

            if ((isSweepLow || isSweepHigh) && isImbalance) {
                total++;
                let isBuy = isSweepLow;
                let risk = isBuy ? (c.close - c.low) : (c.high - c.close);
                let targetTP = isBuy ? c.close + (risk * 2.0) : c.close - (risk * 2.0);
                let stopLoss = isBuy ? c.low - (risk * 0.1) : c.high + (risk * 0.1);

                let hit = false;
                for (let j = i + 1; j <= Math.min(i + 20, klines.length - 1); j++) {
                    if (isBuy) {
                        if (klines[j].high >= targetTP) { hit = true; break; }
                        if (klines[j].low <= stopLoss) break;
                    } else {
                        if (klines[j].low <= targetTP) { hit = true; break; }
                        if (klines[j].high >= stopLoss) break;
                    }
                }
                if (hit) wins++;
            }
        }

        let winRate = total > 0 ? ((wins / total) * 100).toFixed(1) : 0.0;
        
        return {
            totalScans: total,
            wins: wins,
            winRate: winRate,
            labels: labels,
            bestCombo: "Sweep + Vol Imbalance + Magnet TP (1:2 R:R)"
        };
    }
};
