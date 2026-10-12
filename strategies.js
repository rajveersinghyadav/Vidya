/**
 * Vidya Strategies Module - Pure Liquidity Sweep & Orderflow Imbalance
 * ZERO Dummy Data. Live Binance WebSocket & Klines Integration.
 */

const VidyaStrategies = {
    wsConnection: null,
    liveDepth: { bids: [], asks: [] },
    liveTrades: [],

    fetchKlines: async function(symbol, interval, limit=100) {
        let apiSymbol = symbol === 'XAUUSD' ? 'PAXGUSDT' : symbol;
        try {
            let res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${apiSymbol}&interval=${interval}&limit=${limit}`);
            let data = await res.json();
            return data.map(k => ({
                time: k[0],
                open: parseFloat(k[1]),
                high: parseFloat(k[2]),
                low: parseFloat(k[3]),
                close: parseFloat(k[4]),
                volume: parseFloat(k[5])
            }));
        } catch(e) { return null; }
    },

    // Extract Liquidity Levels (PDH, PDL, ASH, ASL)
    extractSMCLabels: async function(symbol) {
        let d1 = await this.fetchKlines(symbol, '1d', 10);
        let h1 = await this.fetchKlines(symbol, '1h', 30);
        if (!d1 || !h1) return null;

        let pdh = d1.length >= 2 ? d1[d1.length - 2].high : d1[0].high;
        let pdl = d1.length >= 2 ? d1[d1.length - 2].low : d1[0].low;
        let asianSlice = h1.slice(-24, -16);
        let ash = asianSlice.length > 0 ? Math.max(...asianSlice.map(c => c.high)) : Math.max(...h1.map(c => c.high));
        let asl = asianSlice.length > 0 ? Math.min(...asianSlice.map(c => c.low)) : Math.min(...h1.map(c => c.low));

        return { pdh, pdl, ash, asl };
    },

    // Live WebSocket for Heatmap & Volume Imbalance
    initWebSocket: function(symbol, callback) {
        let apiSymbol = symbol === 'XAUUSD' ? 'paxgusdt' : symbol.toLowerCase();
        if (this.wsConnection) this.wsConnection.close();

        this.wsConnection = new WebSocket(`wss://stream.binance.com:9443/ws/${apiSymbol}@depth10@100ms/${apiSymbol}@aggTrade`);
        this.wsConnection.onmessage = (event) => {
            let data = JSON.parse(event.data);
            if (data.bids && data.asks) {
                this.liveDepth.bids = data.bids.map(b => ({ price: parseFloat(b[0]), qty: parseFloat(b[1]) }));
                this.liveDepth.asks = data.asks.map(a => ({ price: parseFloat(a[0]), qty: parseFloat(a[1]) }));
            }
            if (data.e === 'aggTrade') {
                this.liveTrades.push({ price: parseFloat(data.p), qty: parseFloat(data.q), isBuyerMaker: data.m });
                if (this.liveTrades.length > 100) this.liveTrades.shift();
                if (callback) callback();
            }
        };
    },

    checkVolumeDeltaImbalance: function() {
        if (this.liveTrades.length < 15) return { ratio: 1.0, isBuyerAggressive: false, isSellerAggressive: false };
        let buyVol = 0, sellVol = 0;
        this.liveTrades.forEach(t => {
            if (t.isBuyerMaker) sellVol += t.qty;
            else buyVol += t.qty;
        });
        let ratio = sellVol > 0 ? (buyVol / sellVol) : buyVol;
        return {
            ratio: parseFloat(ratio.toFixed(2)),
            isBuyerAggressive: ratio >= 2.2,
            isSellerAggressive: ratio <= 0.45
        };
    },

    getHeatmapMagnetWalls: function() {
        if (!this.liveDepth.bids.length || !this.liveDepth.asks.length) return null;
        let buyWall = this.liveDepth.bids.reduce((max, b) => b.qty > max.qty ? b : max, this.liveDepth.bids[0]);
        let sellWall = this.liveDepth.asks.reduce((max, a) => a.qty > max.qty ? a : max, this.liveDepth.asks[0]);
        return { buyWall, sellWall };
    }
};
