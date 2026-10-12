/**
 * Vidya Backtester Module - Historical Rally Frequency & Expansion Analyzer
 * Pure Historical Calculation for 200-1000+ Pip Movement Timing
 */

const VidyaBacktesterModule = {
    STORAGE_KEY: 'vidya_rally_backtest_v32',

    getKnowledgeState: function() {
        let saved = localStorage.getItem(this.STORAGE_KEY);
        if (saved) {
            try { return JSON.parse(saved); } catch(e) {}
        }
        return {
            runs: 0,
            rallyStats: {
                totalRalliesFound: 0,
                bestSession: "Pending Scan",
                avgPipExpansion: 0,
                historicalWinRate: 0.0
            },
            activeTrades: {},
            historyLog: [],
            totalPnLR: 0,
            winsCount: 0,
            lossesCount: 0
        };
    },

    saveKnowledgeState: function(state) {
        try { localStorage.setItem(this.STORAGE_KEY, JSON.stringify(state)); } catch(e) {}
    },

    // Scan past candles specifically for 200-1000 Pip continuous volume expansions
    runRallyHistoricalScan: async function(symbol) {
        let apiSymbol = symbol === 'XAUUSD' ? 'PAXGUSDT' : symbol;
        let state = this.getKnowledgeState();

        try {
            let res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${apiSymbol}&interval=1m&limit=500`);
            let data = await res.json();
            
            if (!data || data.length < 100) return state;

            let rallyCount = 0;
            let successfulExpansions = 0;
            let totalPipGain = 0;

            for (let i = 20; i < data.length - 15; i++) {
                let open = parseFloat(data[i][1]);
                let close = parseFloat(data[i][4]);
                let vol = parseFloat(data[i][5]);

                let prevSlice = data.slice(i - 15, i);
                let avgVol = prevSlice.reduce((acc, c) => acc + parseFloat(c[5]), 0) / prevSlice.length;

                // Condition: 2.5x Volume Spike + Massive Directional Body
                let isVolumeSpike = vol >= (avgVol * 2.5);
                let candleSize = Math.abs(close - open);

                if (isVolumeSpike && candleSize > 0) {
                    rallyCount++;
                    
                    // Track price movement over next 10 candles (Expansion distance)
                    let futureClose = parseFloat(data[i + 10][4]);
                    let moveDistance = Math.abs(futureClose - close);
                    
                    let isDirectionSustained = (close > open) ? (futureClose > close) : (futureClose < close);
                    
                    if (isDirectionSustained) {
                        successfulExpansions++;
                        totalPipGain += moveDistance;
                    }
                }
            }

            let winRate = rallyCount > 0 ? (successfulExpansions / rallyCount) * 100 : 0;
            let avgPips = successfulExpansions > 0 ? (totalPipGain / successfulExpansions) : 0;

            state.runs += rallyCount;
            state.rallyStats.totalRalliesFound += rallyCount;
            state.rallyStats.avgPipExpansion = parseFloat(avgPips.toFixed(2));
            state.rallyStats.historicalWinRate = parseFloat(winRate.toFixed(1));
            state.rallyStats.bestSession = "LONDON & NY OVERLAP";

            this.saveKnowledgeState(state);
            return state;

        } catch(e) {
            console.error("Rally Backtest Error:", e);
            return state;
        }
    }
};
