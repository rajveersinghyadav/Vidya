/**
 * Vidya Backtester - Real Historical Rally & Volume Delta Scanner (FIXED)
 */

const VidyaBacktesterModule = {
    STORAGE_KEY: 'vidya_rally_backtest_v33_fixed',

    getKnowledgeState: function() {
        let saved = localStorage.getItem(this.STORAGE_KEY);
        if (saved) {
            try {
                let parsed = JSON.parse(saved);
                return {
                    totalScans: parsed.totalScans || 0,
                    rallyWins: parsed.rallyWins || 0,
                    rallyLosses: parsed.rallyLosses || 0,
                    calculatedWinRate: parsed.calculatedWinRate || 0.0
                };
            } catch(e) {}
        }
        return {
            totalScans: 0,
            rallyWins: 0,
            rallyLosses: 0,
            calculatedWinRate: 0.0
        };
    },

    saveKnowledgeState: function(state) {
        try { localStorage.setItem(this.STORAGE_KEY, JSON.stringify(state)); } catch(e) {}
    },

    runRealRallyBacktest: async function(symbol) {
        let apiSymbol = symbol === 'XAUUSD' ? 'PAXGUSDT' : symbol;
        let state = this.getKnowledgeState();

        try {
            let res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${apiSymbol}&interval=1m&limit=300`);
            let data = await res.json();
            if (!data || !Array.isArray(data) || data.length < 50) return state;

            let wins = 0;
            let losses = 0;

            for (let i = 20; i < data.length - 10; i++) {
                let close = parseFloat(data[i][4]);
                let open = parseFloat(data[i][1]);
                let vol = parseFloat(data[i][5]);

                let prevSlice = data.slice(i - 15, i);
                let avgVol = prevSlice.reduce((acc, c) => acc + parseFloat(c[5]), 0) / prevSlice.length;

                let isVolumeSpike = vol >= (avgVol * 1.8);
                let isExpansion = Math.abs(close - open) > (Math.abs(parseFloat(data[i-1][4]) - parseFloat(data[i-1][1])) * 1.3);

                if (isVolumeSpike && isExpansion) {
                    let isBuy = close > open;
                    let futurePrice = parseFloat(data[i + 5][4]);

                    let targetHit = isBuy ? (futurePrice > close) : (futurePrice < close);
                    if (targetHit) wins++;
                    else losses++;
                }
            }

            let iterationTotal = wins + losses;
            state.totalScans = (state.totalScans || 0) + iterationTotal;
            state.rallyWins = (state.rallyWins || 0) + wins;
            state.rallyLosses = (state.rallyLosses || 0) + losses;
            
            let grandTotal = state.rallyWins + state.rallyLosses;
            state.calculatedWinRate = grandTotal > 0 ? parseFloat(((state.rallyWins / grandTotal) * 100).toFixed(1)) : 0.0;

            this.saveKnowledgeState(state);
            return state;

        } catch(e) {
            console.error("Backtest Error:", e);
            return state;
        }
    }
};
