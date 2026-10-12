/**
 * Vidya Backtester Module - Background Optimizer & Persistent Weights
 */

const VidyaBacktesterModule = {
    STORAGE_KEY: 'vidya_modular_system_v30',

    getKnowledgeState: function() {
        let saved = localStorage.getItem(this.STORAGE_KEY);
        if (saved) {
            try { return JSON.parse(saved); } catch(e) {}
        }
        return {
            runs: 7250,
            weights: { sweep: 97.0, delta: 94.0, magnet: 99.0, rally: 93.0 },
            activeTrades: {},
            historyLog: [],
            totalPnLR: 0,
            winsCount: 0,
            lossesCount: 0
        };
    },

    saveKnowledgeState: function(state) {
        try { localStorage.setItem(this.STORAGE_KEY, JSON.stringify(state)); } catch(e) {}
    }
};
