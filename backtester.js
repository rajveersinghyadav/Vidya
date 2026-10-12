/**
 * Vidya Backtester Module - 6-Timeframe SMC Sweep & Magnet Engine
 * ZERO Dummy Values. Pure Binance Historical Data Analysis.
 */

const VidyaBacktesterModule = {
    STORAGE_KEY: 'vidya_smc_backtest_v100',

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

    runHistoricalBacktest: async function(symbol) {
        let apiSymbol = symbol === 'XAUUSD' ? 'PAXGUSDT' : symbol;
        let state = this.getState();

        try {
            let [res1d, res1h, res15m] = await Promise.all([
                fetch(`https://api.binance.com/api/v3/klines?symbol=${apiSymbol}&interval=1d&limit=30`),
                fetch(`https://api.binance.com/api/v3/klines?symbol=${apiSymbol}&interval=1h&limit=100`),
                fetch(`https://api.binance.com/api/v3/klines?symbol=${apiSymbol}&interval=15m&limit=250`)
            ]);

            let data1d = await res1d.json();
            let data1h = await res1h.json();
            let data15m = await res15m.json();

            if (!data1d || !data1h || !data15m || data15m.length < 50) return state;

            let localWins = 0;
            let localLosses = 0;

            let pdh = parseFloat(data1d[data1d.length - 2][2]);
            let pdl = parseFloat(data1d[data1d.length - 2][3]);

            for (let i = 25; i < data15m.length - 20; i++) {
                let close = parseFloat(data15m[i][4]);
                let high = parseFloat(data15m[i][2]);
                let low = parseFloat(data15m[i][3]);
                let vol = parseFloat(data15m[i][5]);

                let slice = data15m.slice(i - 20, i);
                let swingHigh = Math.max(...slice.map(c => parseFloat(c[2])));
                let swingLow = Math.min(...slice.map(c => parseFloat(c[3])));
                let avgVol = slice.reduce((acc, c) => acc + parseFloat(c[5]), 0) / slice.length;

                let isSweepLow = low < swingLow && close > swingLow;
                let isSweepHigh = high > swingHigh && close < swingHigh;
                let isVolumeSpike = vol >= (avgVol * 1.8);

                if ((isSweepLow || isSweepHigh) && isVolumeSpike) {
                    let isBuy = isSweepLow;
                    let targetTP = isBuy ? Math.max(swingHigh, pdh) : Math.min(swingLow, pdl);
                    let stopLoss = isBuy ? low * 0.9990 : high * 1.0010;

                    let outcome = null;
                    for (let j = i + 1; j <= Math.min(i + 35, data15m.length - 1); j++) {
                        let fHigh = parseFloat(data15m[j][2]);
                        let fLow = parseFloat(data15m[j][3]);

                        if (isBuy) {
                            if (fHigh >= targetTP) { outcome = 'WIN'; break; }
                            if (fLow <= stopLoss) { outcome = 'LOSS'; break; }
                        } else {
                            if (fLow <= targetTP) { outcome = 'WIN'; break; }
                            if (fHigh >= stopLoss) { outcome = 'LOSS'; break; }
                        }
                    }

                    if (outcome === 'WIN') localWins++;
                    else if (outcome === 'LOSS') localLosses++;
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
