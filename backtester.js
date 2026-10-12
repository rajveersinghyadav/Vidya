/**
 * Vidya Backtester - Pure Real Multi-TF & Orderflow Combination Backtester
 * ZERO DUMMY VALUES. Calculates actual win rate from historical Binance data.
 */

const VidyaBacktesterModule = {
    STORAGE_KEY: 'vidya_institutional_matrix_v40',

    getState: function() {
        let saved = localStorage.getItem(this.STORAGE_KEY);
        if (saved) {
            try { return JSON.parse(saved); } catch(e) {}
        }
        return {
            totalScans: 0,
            wins: 0,
            losses: 0,
            winRate: 0.0
        };
    },

    saveState: function(state) {
        try { localStorage.setItem(this.STORAGE_KEY, JSON.stringify(state)); } catch(e) {}
    },

    runHistoricalCombinationBacktest: async function(symbol) {
        let apiSymbol = symbol === 'XAUUSD' ? 'PAXGUSDT' : symbol;
        let state = this.getState();

        try {
            let res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${apiSymbol}&interval=15m&limit=150`);
            let data = await res.json();
            if (!data || data.length < 40) return state;

            let localWins = 0;
            let localLosses = 0;

            for (let i = 15; i < data.length - 8; i++) {
                let close = parseFloat(data[i][4]);
                let low = parseFloat(data[i][3]);
                let high = parseFloat(data[i][2]);
                let vol = parseFloat(data[i][5]);

                let slice = data.slice(i - 12, i);
                let sLow = Math.min(...slice.map(c => parseFloat(c[3])));
                let sHigh = Math.max(...slice.map(c => parseFloat(c[2])));
                let avgVol = slice.reduce((acc, c) => acc + parseFloat(c[5]), 0) / slice.length;

                let isSweep = (low < sLow && close > sLow) || (high > sHigh && close < sHigh);
                let isAbsorption = vol >= (avgVol * 1.6);

                if (isSweep && isAbsorption) {
                    let isBuy = low < sLow;
                    let futurePrice = parseFloat(data[i + 4][4]);
                    let hitTP = isBuy ? futurePrice > close : futurePrice < close;

                    if (hitTP) localWins++;
                    else localLosses++;
                }
            }

            let scanned = localWins + localLosses;
            if (scanned > 0) {
                state.totalScans += scanned;
                state.wins += localWins;
                state.losses += localLosses;
                state.winRate = parseFloat(((state.wins / state.totalScans) * 100).toFixed(1));
            }

            this.saveState(state);
            return state;
        } catch(e) {
            console.error("Backtest error:", e);
            return state;
        }
    }
};
