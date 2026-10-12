/**
 * Vidya Strategies Module - WebSockets, Orderflow Delta & Depth Matrix
 * ZERO Dummy / Fake Data. Pure Binance Execution.
 */

const VidyaStrategies = {
    wsConnection: null,
    liveDepth: { bids: [], asks: [] },
    liveTrades: [],

    // Multi-Timeframe Data Fetcher (1D, 4H, 1H, 15m, 5m, 1m)
    fetch6TFData: async function(symbol) {
        let apiSymbol = symbol === 'XAUUSD' ? 'PAXGUSDT' : symbol;
        const timeframes = ['1d', '4h', '1h', '15m', '5m', '1m'];
        let result = {};
        try {
            for (let tf of timeframes) {
                let limit = (tf === '1m' || tf === '5m') ? 100 : 50;
                let res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${apiSymbol}&interval=${tf}&limit=${limit}`);
                let data = await res.json();
                result[tf] = data.map(k => ({
                    time: k[0],
                    open: parseFloat(k[1]),
                    high: parseFloat(k[2]),
                    low: parseFloat(k[3]),
                    close: parseFloat(k[4]),
                    volume: parseFloat(k[5])
                }));
            }
            return result;
        } catch(e) { return null; }
    },

    // Extract SMC Liquidity Labels (PDH, PDL, ASH, ASL)
    extractSMCLabels: function(tfData) {
        if (!tfData || !tfData['1d'] || !tfData['1h']) return null;

        let d1 = tfData['1d'];
        let h1 = tfData['1h'];

        let pdh = d1.length >= 2 ? d1[d1.length - 2].high : d1[0].high;
        let pdl = d1.length >= 2 ? d1[d1.length - 2].low : d1[0].low;

        let asianSlice = h1.slice(-24, -16);
        let ash = asianSlice.length > 0 ? Math.max(...asianSlice.map(c => c.high)) : Math.max(...h1.map(c => c.high));
        let asl = asianSlice.length > 0 ? Math.min(...asianSlice.map(c => c.low)) : Math.min(...h1.map(c => c.low));

        return { pdh, pdl, ash, asl };
    },

    // Real-Time Binance WebSocket Connection
    initWebSocketStream: function(symbol, onTradeCallback) {
        let apiSymbol = symbol === 'XAUUSD' ? 'paxgusdt' : symbol.toLowerCase();
        
        if (this.wsConnection) {
            this.wsConnection.close();
        }

        let streamUrl = `wss://stream.binance.com:9443/ws/${apiSymbol}@depth10@100ms/${apiSymbol}@aggTrade`;
        this.wsConnection = new WebSocket(streamUrl);

        this.wsConnection.onmessage = (event) => {
            let data = JSON.parse(event.data);
            
            if (data.bids && data.asks) {
                this.liveDepth.bids = data.bids.map(b => ({ price: parseFloat(b[0]), qty: parseFloat(b[1]) }));
                this.liveDepth.asks = data.asks.map(a => ({ price: parseFloat(a[0]), qty: parseFloat(a[1]) }));
            }

            if (data.e === 'aggTrade') {
                this.liveTrades.push({
                    price: parseFloat(data.p),
                    qty: parseFloat(data.q),
                    isBuyerMaker: data.m,
                    time: data.T
                });

                if (this.liveTrades.length > 150) this.liveTrades.shift();
                if (onTradeCallback) onTradeCallback(parseFloat(data.p));
            }
        };
    },

    // Calculate Delta Imbalance Ratio
    calculateDeltaImbalance: function() {
        if (this.liveTrades.length < 20) return { deltaRatio: 1.0, isBuyerAggressive: false, isSellerAggressive: false };

        let buyerVolume = 0;
        let sellerVolume = 0;

        this.liveTrades.forEach(t => {
            if (t.isBuyerMaker) sellerVolume += t.qty;
            else buyerVolume += t.qty;
        });

        let deltaRatio = sellerVolume > 0 ? (buyerVolume / sellerVolume) : buyerVolume;

        return {
            deltaRatio: parseFloat(deltaRatio.toFixed(2)),
            isBuyerAggressive: deltaRatio >= 2.2,
            isSellerAggressive: deltaRatio <= 0.45
        };
    },

    // Get Orderbook Heatmap Liquidity Walls
    getHeatmapWalls: function() {
        if (!this.liveDepth.bids.length || !this.liveDepth.asks.length) return null;

        let buyWall = this.liveDepth.bids.reduce((max, b) => b.qty > max.qty ? b : max, this.liveDepth.bids[0]);
        let sellWall = this.liveDepth.asks.reduce((max, a) => a.qty > max.qty ? a : max, this.liveDepth.asks[0]);

        return { buyWall, sellWall };
    }
};
