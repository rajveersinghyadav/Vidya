/**
 * Vidya Backtester Module
 * Pure Binance Historical Sweep-to-Magnet Backtest
 * ZERO Fake Values. Calculates Real Win Rate continuously.
 */

const VidyaBacktesterModule = {
    STORAGE_KEY: 'vidya_sweep_magnet_v50',

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

    runRealHistoricalSweepBacktest: async function(symbol) {
        let apiSymbol = symbol === 'XAUUSD' ? 'PAXGUSDT' : symbol;
        let state = this.getState();

        try {
            let res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${apiSymbol}&interval=15m&limit=300`);
            let data = await res.json();
            if (!data || data.length < 50) return state;

            let localWins = 0;
            let localLosses = 0;

            for (let i = 25; i < data.length - 12; i++) {
                let close = parseFloat(data[i][4]);
                let high = parseFloat(data[i][2]);
                let low = parseFloat(data[i][3]);
                let vol = parseFloat(data[i][5]);

                let slice = data.slice(i - 20, i);
                let swingHigh = Math.max(...slice.map(c => parseFloat(c[2])));
                let swingLow = Math.min(...slice.map(c => parseFloat(c[3])));
                let avgVol = slice.reduce((acc, c) => acc + parseFloat(c[5]), 0) / slice.length;

                let isSweepLow = low < swingLow && close > swingLow;
                let isSweepHigh = high > swingHigh && close < swingHigh;
                let isVolumeSpike = vol >= (avgVol * 1.8);

                if ((isSweepLow || isSweepHigh) && isVolumeSpike) {
                    let isBuy = isSweepLow;
                    let targetTP = isBuy ? swingHigh : swingLow;
                    let stopLoss = isBuy ? low * 0.9985 : high * 1.0015;

                    let hitTP = false;
                    for (let j = i + 1; j <= i + 12; j++) {
                        let fHigh = parseFloat(data[j][2]);
                        let fLow = parseFloat(data[j][3]);

                        if (isBuy) {
                            if (fHigh >= targetTP) { hitTP = true; break; }
                            if (fLow <= stopLoss) { hitTP = false; break; }
                        } else {
                            if (fLow <= targetTP) { hitTP = true; break; }
                            if (fHigh >= stopLoss) { hitTP = false; break; }
                        }
                    }

                    if (hitTP) localWins++;
                    else localLosses++;
                }
            }

            let validTotal = localWins + localLosses;
            if (validTotal > 0) {
                state.totalScans += validTotal;
                state.wins += localWins;
                state.losses += localLosses;

                let grandTotal = state.wins + state.losses;
                state.winRate = grandTotal > 0 ? parseFloat(((state.wins / grandTotal) * 100).toFixed(1)) : 0.0;
            }

            this.saveState(state);
            return state;

        } catch(e) {
            console.error("Backtest Error:", e);
            return state;
        }
    }
};
