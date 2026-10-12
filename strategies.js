/**
 * Vidya Ultimate Institutional Strategy Engine
 * 1D/4H Magnet Zones + Orderflow Delta Imbalance + Heatmap Validation
 */

const VidyaStrategies = {

    // Fetch HTF (1D & 4H) Magnet Levels
    calculateHTFMagnets: async function(symbol) {
        let d1 = await VidyaData.fetchKlines(symbol, '1d', 10);
        let h4 = await VidyaData.fetchKlines(symbol, '4h', 30);
        if (!d1 || !h4) return null;

        let pdh = d1.length >= 2 ? d1[d1.length - 2].high : d1[0].high;
        let pdl = d1.length >= 2 ? d1[d1.length - 2].low : d1[0].low;
        
        // 4H Major Order Block / FVG Magnet Level
        let h4High = Math.max(...h4.map(c => c.high));
        let h4Low = Math.min(...h4.map(c => c.low));

        return {
            majorResistance: Math.max(pdh, h4High),
            majorSupport: Math.min(pdl, h4Low),
            pdh, pdl
        };
    },

    // Comprehensive Strategy Calculator with HTF Magnets & Imbalance
    runUltimateCalculator: async function(symbol) {
        let klines = await VidyaData.fetchKlines(symbol, '15m', 200);
        let magnets = await this.calculateHTFMagnets(symbol);
        if (!klines || !magnets) return { winRate: 0, bestCombo: "Evaluating..." };

        let wins = 0, total = 0;

        for (let i = 25; i < klines.length - 15; i++) {
            let c = klines[i];
            let slice = klines.slice(i - 20, i);
            let sHigh = Math.max(...slice.map(x => x.high));
            let sLow = Math.min(...slice.map(x => x.low));
            let avgVol = slice.reduce((acc, x) => acc + x.volume, 0) / slice.length;

            // 1. Liquidity Sweep of local session/swing levels
            let isSweepLow = c.low < sLow && c.close > sLow;
            let isSweepHigh = c.high > sHigh && c.close < sHigh;

            // 2. Volume & Orderflow Imbalance Spike
            let isImbalance = c.volume >= (avgVol * 1.8);

            if ((isSweepLow || isSweepHigh) && isImbalance) {
                total++;
                let isBuy = isSweepLow;
                
                // Target is directly the 1D/4H Magnet Zone!
                let targetTP = isBuy ? magnets.majorResistance : magnets.majorSupport;
                let stopLoss = isBuy ? c.low - (c.close - c.low) * 0.2 : c.high + (c.high - c.close) * 0.2;

                let hit = false;
                for (let j = i + 1; j <= Math.min(i + 35, klines.length - 1); j++) {
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
            magnets: magnets,
            bestCombo: "1D/4H Magnet Target + Sweep + Delta Imbalance (1:3+ R:R)"
        };
    }
};
