/**
 * Vidya Data Engine - Historical & Live Binance Feeds
 * Zero Dummy Data. Pure Real-Time API/WebSocket.
 */

const VidyaData = {
    ws: null,
    
    // Fetch Historical Candles
    fetchKlines: async function(symbol, interval, limit=150) {
        let apiSymbol = symbol === 'XAUUSD' ? 'PAXGUSDT' : symbol;
        try {
            let res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${apiSymbol}&interval=${interval}&limit=${limit}`);
            if (!res.ok) return null;
            let data = await res.json();
            return data.map(k => ({
                time: k[0],
                open: parseFloat(k[1]),
                high: parseFloat(k[2]),
                low: parseFloat(k[3]),
                close: parseFloat(k[4]),
                volume: parseFloat(k[5])
            }));
        } catch(e) {
            console.error("Data Fetch Error:", e);
            return null;
        }
    },

    // Real-Time Live Price & Trades WebSocket
    initLiveStream: function(symbol, onTickCallback) {
        let apiSymbol = symbol === 'XAUUSD' ? 'paxgusdt' : symbol.toLowerCase();
        if (this.ws) this.ws.close();

        this.ws = new WebSocket(`wss://stream.binance.com:9443/ws/${apiSymbol}@ticker/${apiSymbol}@aggTrade`);
        this.ws.onmessage = (event) => {
            let data = JSON.parse(event.data);
            if (data.c) { // Ticker price
                onTickCallback({ price: parseFloat(data.c), high: parseFloat(data.h), low: parseFloat(data.l) });
            }
        };
    }
};
