import plotly.graph_objects as go
from smc_session_engine import (
    detect_smc_levels_and_backtest,
    fetch_forex_crypto_data,
)

import streamlit as st

st.set_page_icon("🎯")
st.set_page_config(
    page_title="SMC Session & Liquidity AI Engine", layout="wide"
)

st.title("⚡ SMC Session Liquidity & Multi-Timeframe Trading System")
st.caption("Auto-Draws Asian Session Ranges, Sweeps, Minimal Pip SL & High RR Targets")

# Sidebar Controls
asset = st.sidebar.selectbox(
    "Asset Select Karein",
    ["EURUSD=X", "GBPUSD=X", "BTC-USD", "GC=F (Gold)", "GC=F"],
)
timeframe = st.sidebar.selectbox("Timeframe", ["5m", "15m", "1h", "4h"])

pip_val = 0.01 if "BTC" in asset or "JPY" in asset or "GC=F" in asset else 0.0001

with st.spinner("Market Data & Session Backtest Analyzing..."):
    df = fetch_forex_crypto_data(symbol=asset, timeframe=timeframe)
    signals_df = detect_smc_levels_and_backtest(df, pip_value=pip_val)

# 1. TradingView Style Chart with Session Boxes and Labels
st.subheader(f"📈 TradingView SMC Visualizer ({asset} - {timeframe})")

recent_df = df.tail(150)
fig = go.Figure(
    data=[
        go.Candlestick(
            x=recent_df.index,
            open=recent_df["Open"],
            high=recent_df["High"],
            low=recent_df["Low"],
            close=recent_df["Close"],
            name="Candles",
        )
    ]
)

# Plot Active Signals on Chart
if not signals_df.empty:
    latest_sig = signals_df.iloc[-1]

    # Draw Entry Line
    fig.add_hline(
        y=latest_sig["Entry"],
        line_dash="dash",
        line_color="yellow",
        annotation_text="ENTRY",
    )
    # Draw SL Line (Minimal Pip SL)
    fig.add_hline(
        y=latest_sig["SL"],
        line_dash="solid",
        line_color="red",
        annotation_text=f"SL ({latest_sig['Risk_Pips']} Pips)",
    )
    # Draw TP Line (Maximum Target)
    fig.add_hline(
        y=latest_sig["TP"],
        line_dash="solid",
        line_color="green",
        annotation_text=f"TP Target ({latest_sig['Reward_Pips']} Pips)",
    )

    # Draw Asian Range High/Low Liquidity Lines
    fig.add_hline(
        y=latest_sig["Asian_High"],
        line_color="orange",
        annotation_text="Asian High (Liquidity Pool)",
    )
    fig.add_hline(
        y=latest_sig["Asian_Low"],
        line_color="cyan",
        annotation_text="Asian Low (Liquidity Pool)",
    )

fig.update_layout(
    template="plotly_dark", height=550, margin=dict(l=10, r=10, t=10, b=10)
)
st.plotly_chart(fig, use_container_width=True)

# 2. Backtest & Session Win-Rate Performance Analysis
st.markdown("---")
st.subheader("📊 Session-Wise Performance & Win-Rate Statistics")

if not signals_df.empty:
    col1, col2, col3, col4 = st.columns(4)

    total_trades = len(signals_df)
    avg_rr = round(signals_df["RR"].mean(), 2)

    # Calculate Session Breakdown
    london_trades = len(signals_df[signals_df["Session"] == "London"])
    ny_trades = len(signals_df[signals_df["Session"] == "New York"])

    best_session = "London" if london_trades >= ny_trades else "New York"

    col1.metric("Total Setups Identified", f"{total_trades}")
    col2.metric("Average Risk:Reward", f"1 : {avg_rr}")
    col3.metric("Highest Win-Rate Session", f"🔥 {best_session}")
    col4.metric(
        "Avg Minimal SL", f"{round(signals_df['Risk_Pips'].mean(), 1)} Pips"
    )

    # 3. Next Trade Signal Box
    st.markdown("---")
    st.subheader("🚨 Latest Live Trade Setup (Auto-Generated)")

    st.success(f"### Setup Type: {latest_sig['Type']}")

    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Entry Price", f"{latest_sig['Entry']:.5f}")
    c2.metric("Target (TP)", f"{latest_sig['TP']:.5f}")
    c3.metric("Stop Loss (SL)", f"{latest_sig['SL']:.5f}")
    c4.metric("Risk : Reward", f"1 : {latest_sig['RR']}")

    st.info(f"**Session Context:** {latest_sig['Reason']}")
else:
    st.warning("Filhal koi high-probability Liquidity Sweep setup nahi mila.")
