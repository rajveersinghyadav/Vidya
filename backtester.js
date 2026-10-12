/**
 * Vidya Backtester Module - Standalone Error-Free Execution
 */

const VidyaBacktesterModule = {
    STORAGE_KEY: 'vidya_backtest_state_v200',

    getState: function() {
        let saved = localStorage.getItem(this.STORAGE_KEY);
        if (saved) { 
            try { return JSON.parse(saved); } catch(e) {} 
        }
        return { totalScans: 0, wins: 0, losses: 0, winRate: 0.0 };
    },

    saveState: function(state) {
        try { localStorage.setItem(this.STORAGE_KEY, JSON.stringify(state)); } catch(e) {}
    },

    runBacktest: async function(symbol) {
        let state = this.getState();
        try {
            let klines = await VidyaStrategies.fetchKlines(symbol, '15m', 150);
            if (!klines || klines.length < 40) return state;

            let wins = 0, losses = 0;
            for (let i = 15; i < klines.length - 15; i++) {
                let close = klines[i].close;
                let high = klines[i].high;
                let low = klines[i].low;
                let vol = klines[i].volume;

                let slice = klines.slice(i - 15, i);
                let sHigh = Math.max(...slice.map(c => c.high));
                let sLow = Math.min(...slice.map(c => c.low));
                let avgVol = slice.reduce((acc, c) => acc + c.volume, 0) / slice.length;

                let isSweepLow = low < sLow && close > sLow;
                let isSweepHigh = high > sHigh && close < sHigh;
                let isVolSpike = vol >= (avgVol * 1.5);

                if ((isSweepLow || isSweepHigh) && isVolSpike) {
                    let isBuy = isSweepLow;
                    let targetTP = isBuy ? sHigh * 1.008 : sLow * 0.992;
                    let stopLoss = isBuy ? low * 0.9985 : high * 1.0015;

                    let hit = null;
                    for (let j = i + 1; j <= Math.min(i + 20, klines.length - 1); j++) {
                        if (isBuy) {
                            if (klines[j].high >= targetTP) { hit = 'WIN'; break; }
                            if (klines[j].low <= stopLoss) { hit = 'LOSS'; break; }
                        } else {
                            if (klines[j].low <= targetTP) { hit = 'WIN'; break; }
                            if (klines[j].high >= stopLoss) { hit = 'LOSS'; break; }
                        }
                    }
                    if (hit === 'WIN') wins++;
                    else if (hit === 'LOSS') losses++;
                }
            }

            let total = wins + losses;
            if (total > 0) {
                state.totalScans += total;
                state.wins += wins;
                state.losses += losses;
                let grand = state.wins + state.losses;
                state.winRate = grand > 0 ? parseFloat(((state.wins / grand) * 100).toFixed(1)) : 0.0;
            }
            this.saveState(state);
            return state;
        } catch(e) {
            console.error("Backtest Error:", e);
            return state;
        }
    }
};
