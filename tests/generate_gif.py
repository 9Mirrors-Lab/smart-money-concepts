import argparse
import os
import sys

import imageio
import numpy as np
import pandas as pd
import plotly.graph_objects as go
from io import BytesIO
from PIL import Image

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from smartmoneyconcepts.smc import smc

# Default CSV: KCEX ETHUSDT 23m in project root
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
DEFAULT_CSV = os.path.join(PROJECT_ROOT, "KCEX_ETHUSDT.P, 23_ce49b.csv")


def load_csv_data(csv_path: str) -> pd.DataFrame:
    """Load OHLCV CSV (time=Unix seconds, open/high/low/close/Volume); return DataFrame ready for smc."""
    df = pd.read_csv(csv_path)
    df = df.rename(columns={c: c.lower() for c in df.columns})
    if "time" not in df.columns:
        raise ValueError("CSV must have a 'time' column (Unix seconds)")
    ohlcv = ["open", "high", "low", "close", "volume"]
    for col in ohlcv:
        if col not in df.columns:
            raise ValueError(f"CSV must have column '{col}'")
    df = df[["time"] + ohlcv].copy()
    df = df.set_index("time")
    df.index = pd.to_datetime(df.index, unit="s")
    df = df.sort_index()
    return df

def add_FVG(fig, df, fvg_data):
    for i in range(len(fvg_data["FVG"])):
        if not np.isnan(fvg_data["FVG"][i]):
            x1 = int(
                fvg_data["MitigatedIndex"][i]
                if fvg_data["MitigatedIndex"][i] != 0
                else len(df) - 1
            )
            fig.add_shape(
                # filled Rectangle
                type="rect",
                x0=df.index[i],
                y0=fvg_data["Top"][i],
                x1=df.index[x1],
                y1=fvg_data["Bottom"][i],
                line=dict(
                    width=0,
                ),
                fillcolor="yellow",
                opacity=0.2,
            )
            mid_x = round((i + x1) / 2)
            mid_y = (fvg_data["Top"][i] + fvg_data["Bottom"][i]) / 2
            fig.add_trace(
                go.Scatter(
                    x=[df.index[mid_x]],
                    y=[mid_y],
                    mode="text",
                    text="FVG",
                    textposition="middle center",
                    textfont=dict(color='rgba(255, 255, 255, 0.4)', size=8),
                )
            )
    return fig


def add_swing_highs_lows(fig, df, swing_highs_lows_data):
    indexs = []
    level = []
    for i in range(len(swing_highs_lows_data)):
        if not np.isnan(swing_highs_lows_data["HighLow"][i]):
            indexs.append(i)
            level.append(swing_highs_lows_data["Level"][i])

    # plot these lines on a graph
    for i in range(len(indexs) - 1):
        fig.add_trace(
            go.Scatter(
                x=[df.index[indexs[i]], df.index[indexs[i + 1]]],
                y=[level[i], level[i + 1]],
                mode="lines",
                line=dict(
                    color=(
                        "rgba(0, 128, 0, 0.2)"
                        if swing_highs_lows_data["HighLow"][indexs[i]] == -1
                        else "rgba(255, 0, 0, 0.2)"
                    ),
                ),
            )
        )

    return fig


def add_bos_choch(fig, df, bos_choch_data):
    for i in range(len(bos_choch_data["BOS"])):
        if not np.isnan(bos_choch_data["BOS"][i]):
            # add a label to this line
            mid_x = round((i + int(bos_choch_data["BrokenIndex"][i])) / 2)
            mid_y = bos_choch_data["Level"][i]
            fig.add_trace(
                go.Scatter(
                    x=[df.index[i], df.index[int(bos_choch_data["BrokenIndex"][i])]],
                    y=[bos_choch_data["Level"][i], bos_choch_data["Level"][i]],
                    mode="lines",
                    line=dict(
                        color="rgba(255, 165, 0, 0.2)",
                    ),
                )
            )
            fig.add_trace(
                go.Scatter(
                    x=[df.index[mid_x]],
                    y=[mid_y],
                    mode="text",
                    text="BOS",
                    textposition="top center" if bos_choch_data["BOS"][i] == 1 else "bottom center",
                    textfont=dict(color="rgba(255, 165, 0, 0.4)", size=8),
                )
            )
        if not np.isnan(bos_choch_data["CHOCH"][i]):
            # add a label to this line
            mid_x = round((i + int(bos_choch_data["BrokenIndex"][i])) / 2)
            mid_y = bos_choch_data["Level"][i]
            fig.add_trace(
                go.Scatter(
                    x=[df.index[i], df.index[int(bos_choch_data["BrokenIndex"][i])]],
                    y=[bos_choch_data["Level"][i], bos_choch_data["Level"][i]],
                    mode="lines",
                    line=dict(
                        color="rgba(0, 0, 255, 0.2)",
                    ),
                )
            )
            fig.add_trace(
                go.Scatter(
                    x=[df.index[mid_x]],
                    y=[mid_y],
                    mode="text",
                    text="CHOCH",
                    textposition="top center" if bos_choch_data["CHOCH"][i] == 1 else "bottom center",
                    textfont=dict(color="rgba(0, 0, 255, 0.4)", size=8),
                )
            )

    return fig


def add_OB(fig, df, ob_data):
    def format_volume(volume):
        if volume >= 1e12:
            return f"{volume / 1e12:.3f}T"
        elif volume >= 1e9:
            return f"{volume / 1e9:.3f}B"
        elif volume >= 1e6:
            return f"{volume / 1e6:.3f}M"
        elif volume >= 1e3:
            return f"{volume / 1e3:.3f}k"
        else:
            return f"{volume:.2f}"

    for i in range(len(ob_data["OB"])):
        if ob_data["OB"][i] == 1:
            x1 = int(
                ob_data["MitigatedIndex"][i]
                if ob_data["MitigatedIndex"][i] != 0
                else len(df) - 1
            )
            fig.add_shape(
                type="rect",
                x0=df.index[i],
                y0=ob_data["Bottom"][i],
                x1=df.index[x1],
                y1=ob_data["Top"][i],
                line=dict(color="Purple"),
                fillcolor="Purple",
                opacity=0.2,
                name="Bullish OB",
                legendgroup="bullish ob",
                showlegend=True,
            )

            if ob_data["MitigatedIndex"][i] > 0:
                x_center = df.index[int(i + (ob_data["MitigatedIndex"][i] - i) / 2)]
            else:
                x_center = df.index[int(i + (len(df) - i) / 2)]

            y_center = (ob_data["Bottom"][i] + ob_data["Top"][i]) / 2
            volume_text = format_volume(ob_data["OBVolume"][i])
            # Add annotation text
            annotation_text = f'OB: {volume_text} ({ob_data["Percentage"][i]}%)'

            fig.add_annotation(
                x=x_center,
                y=y_center,
                xref="x",
                yref="y",
                align="center",
                text=annotation_text,
                font=dict(color="rgba(255, 255, 255, 0.4)", size=8),
                showarrow=False,
            )

    for i in range(len(ob_data["OB"])):
        if ob_data["OB"][i] == -1:
            x1 = int(
                ob_data["MitigatedIndex"][i]
                if ob_data["MitigatedIndex"][i] != 0
                else len(df) - 1
            )
            fig.add_shape(
                type="rect",
                x0=df.index[i],
                y0=ob_data["Bottom"][i],
                x1=df.index[x1],
                y1=ob_data["Top"][i],
                line=dict(color="Purple"),
                fillcolor="Purple",
                opacity=0.2,
                name="Bearish OB",
                legendgroup="bearish ob",
                showlegend=True,
            )

            if ob_data["MitigatedIndex"][i] > 0:
                x_center = df.index[int(i + (ob_data["MitigatedIndex"][i] - i) / 2)]
            else:
                x_center = df.index[int(i + (len(df) - i) / 2)]

            y_center = (ob_data["Bottom"][i] + ob_data["Top"][i]) / 2
            volume_text = format_volume(ob_data["OBVolume"][i])
            # Add annotation text
            annotation_text = f'OB: {volume_text} ({ob_data["Percentage"][i]}%)'

            fig.add_annotation(
                x=x_center,
                y=y_center,
                xref="x",
                yref="y",
                align="center",
                text=annotation_text,
                font=dict(color="rgba(255, 255, 255, 0.4)", size=8),
                showarrow=False,
            )
    return fig


def add_liquidity(fig, df, liquidity_data):
    # draw a line horizontally for each liquidity level
    for i in range(len(liquidity_data["Liquidity"])):
        if not np.isnan(liquidity_data["Liquidity"][i]):
            fig.add_trace(
                go.Scatter(
                    x=[df.index[i], df.index[int(liquidity_data["End"][i])]],
                    y=[liquidity_data["Level"][i], liquidity_data["Level"][i]],
                    mode="lines",
                    line=dict(
                        color="rgba(255, 165, 0, 0.2)",
                    ),
                )
            )
            mid_x = round((i + int(liquidity_data["End"][i])) / 2)
            fig.add_trace(
                go.Scatter(
                    x=[df.index[mid_x]],
                    y=[liquidity_data["Level"][i]],
                    mode="text",
                    text="Liquidity",
                    textposition="top center" if liquidity_data["Liquidity"][i] == 1 else "bottom center",
                    textfont=dict(color="rgba(255, 165, 0, 0.4)", size=8),
                )
            )
        if liquidity_data["Swept"][i] != 0 and not np.isnan(liquidity_data["Swept"][i]):
            # draw a red line between the end and the swept point
            fig.add_trace(
                go.Scatter(
                    x=[
                        df.index[int(liquidity_data["End"][i])],
                        df.index[int(liquidity_data["Swept"][i])],
                    ],
                    y=[
                        liquidity_data["Level"][i],
                        (
                            df["high"].iloc[int(liquidity_data["Swept"][i])]
                            if liquidity_data["Liquidity"][i] == 1
                            else df["low"].iloc[int(liquidity_data["Swept"][i])]
                        ),
                    ],
                    mode="lines",
                    line=dict(
                        color="rgba(255, 0, 0, 0.2)",
                    ),
                )
            )
            mid_x = round((i + int(liquidity_data["Swept"][i])) / 2)
            mid_y = (
                liquidity_data["Level"][i]
                + (
                    df["high"].iloc[int(liquidity_data["Swept"][i])]
                    if liquidity_data["Liquidity"][i] == 1
                    else df["low"].iloc[int(liquidity_data["Swept"][i])]
                )
            ) / 2
            fig.add_trace(
                go.Scatter(
                    x=[df.index[mid_x]],
                    y=[mid_y],
                    mode="text",
                    text="Liquidity Swept",
                    textposition="top center" if liquidity_data["Liquidity"][i] == 1 else "bottom center",
                    textfont=dict(color="rgba(255, 0, 0, 0.4)", size=8),
                )
            )
    return fig


def add_previous_high_low(fig, df, previous_high_low_data):
    high = previous_high_low_data["PreviousHigh"]
    low = previous_high_low_data["PreviousLow"]

    # create a list of all the different high levels and their indexes
    high_levels = []
    high_indexes = []
    for i in range(len(high)):
        if not np.isnan(high[i]) and high[i] != (high_levels[-1] if len(high_levels) > 0 else None):
            high_levels.append(high[i])
            high_indexes.append(i)

    low_levels = [] 
    low_indexes = []
    for i in range(len(low)):
        if not np.isnan(low[i]) and low[i] != (low_levels[-1] if len(low_levels) > 0 else None):
            low_levels.append(low[i])
            low_indexes.append(i)

    # plot these lines on a graph
    for i in range(len(high_indexes)-1):
        fig.add_trace(
            go.Scatter(
                x=[df.index[high_indexes[i]], df.index[high_indexes[i+1]]],
                y=[high_levels[i], high_levels[i]],
                mode="lines",
                line=dict(
                    color="rgba(255, 255, 255, 0.2)",
                ),
            )
        )
        fig.add_trace(
            go.Scatter(
                x=[df.index[high_indexes[i+1]]],
                y=[high_levels[i]],
                mode="text",
                text="PH",
                textposition="top center",
                textfont=dict(color="rgba(255, 255, 255, 0.4)", size=8),
            )
        )

    for i in range(len(low_indexes)-1):
        fig.add_trace(
            go.Scatter(
                x=[df.index[low_indexes[i]], df.index[low_indexes[i+1]]],
                y=[low_levels[i], low_levels[i]],
                mode="lines",
                line=dict(
                    color="rgba(255, 255, 255, 0.2)",
                ),
            )
        )
        fig.add_trace(
            go.Scatter(
                x=[df.index[low_indexes[i+1]]],
                y=[low_levels[i]],
                mode="text",
                text="PL",
                textposition="bottom center",
                textfont=dict(color="rgba(255, 255, 255, 0.4)", size=8),
            )
        )

    return fig


def add_sessions(fig, df, sessions):
    for i in range(len(sessions["Active"])-1):
        if sessions["Active"][i] == 1:
            fig.add_shape(
                type="rect",
                x0=df.index[i],
                y0=sessions["Low"][i],
                x1=df.index[i + 1],
                y1=sessions["High"][i],
                line=dict(
                    width=0,
                ),
                fillcolor="#16866E",
                opacity=0.2,
            )
    return fig


def add_retracements(fig, df, retracements):
    for i in range(len(retracements)):
        if (
            (
                (
                    retracements["Direction"].iloc[i + 1]
                    if i < len(retracements) - 1
                    else 0
                )
                != retracements["Direction"].iloc[i]
                or i == len(retracements) - 1
            )
            and retracements["Direction"].iloc[i] != 0
            and (
                retracements["Direction"].iloc[i + 1]
                if i < len(retracements) - 1
                else retracements["Direction"].iloc[i]
            )
            != 0
        ):
            fig.add_annotation(
                x=df.index[i],
                y=(
                    df["high"].iloc[i]
                    if retracements["Direction"].iloc[i] == -1
                    else df["low"].iloc[i]
                ),
                xref="x",
                yref="y",
                text=f"C:{retracements['CurrentRetracement%'].iloc[i]}%<br>D:{retracements['DeepestRetracement%'].iloc[i]}%",
                font=dict(color="rgba(255, 255, 255, 0.4)", size=8),
                showarrow=False,
            )
    return fig


# get the data
parser = argparse.ArgumentParser(description="Generate SMC indicator GIF from OHLCV CSV.")
parser.add_argument(
    "csv",
    nargs="?",
    default=DEFAULT_CSV,
    help=f"Path to CSV (default: {DEFAULT_CSV})",
)
parser.add_argument(
    "--last",
    type=int,
    default=500,
    help="Use last N bars for the animation (default: 500)",
)
parser.add_argument(
    "--window",
    type=int,
    default=100,
    help="Sliding window size in bars (default: 100)",
)
parser.add_argument(
    "--out",
    default="test.gif",
    help="Output GIF filename (default: test.gif)",
)
parser.add_argument(
    "--width",
    type=int,
    default=500,
    help="Chart width in pixels (default: 500)",
)
parser.add_argument(
    "--height",
    type=int,
    default=300,
    help="Chart height in pixels (default: 300)",
)
parser.add_argument(
    "--scale",
    type=float,
    default=1.0,
    help="Resolution scale (e.g. 2 = 2x pixel density; default: 1)",
)
parser.add_argument(
    "--export-plotly",
    metavar="FILE",
    default=None,
    help="Export the first frame as a Plotly JSON file (e.g. chart.json) for opening in Plotly Chart Studio",
)
args = parser.parse_args()

if not os.path.isfile(args.csv):
    sys.exit(f"CSV not found: {args.csv}")

df = load_csv_data(args.csv)
df = df.iloc[-args.last :]
if len(df) < args.window:
    sys.exit(f"Need at least {args.window} bars; got {len(df)}")

def fig_to_buffer(fig):
    fig_bytes = fig.to_image(format="png", scale=args.scale)
    fig_buffer = BytesIO(fig_bytes)
    fig_image = Image.open(fig_buffer)
    return np.array(fig_image)


gif = []

for pos in range(args.window, len(df)):
    window_df = df.iloc[pos - args.window : pos]

    fig = go.Figure(
        data=[
            go.Candlestick(
                x=window_df.index,
                open=window_df["open"],
                high=window_df["high"],
                low=window_df["low"],
                close=window_df["close"],
                increasing_line_color="#77dd76",
                decreasing_line_color="#ff6962",
            )
        ]
    )

    fvg_data = smc.fvg(window_df, join_consecutive=True)
    swing_highs_lows_data = smc.swing_highs_lows(window_df, swing_length=5)
    bos_choch_data = smc.bos_choch(window_df, swing_highs_lows_data)
    ob_data = smc.ob(window_df, swing_highs_lows_data)
    liquidity_data = smc.liquidity(window_df, swing_highs_lows_data)
    previous_high_low_data = smc.previous_high_low(window_df, time_frame="4h")
    sessions = smc.sessions(window_df, session="London")
    retracements = smc.retracements(window_df, swing_highs_lows_data)
    fig = add_FVG(fig, window_df, fvg_data)
    fig = add_swing_highs_lows(fig, window_df, swing_highs_lows_data)
    fig = add_bos_choch(fig, window_df, bos_choch_data)
    fig = add_OB(fig, window_df, ob_data)
    fig = add_liquidity(fig, window_df, liquidity_data)
    fig = add_previous_high_low(fig, window_df, previous_high_low_data)
    fig = add_sessions(fig, window_df, sessions)
    fig = add_retracements(fig, window_df, retracements)

    fig.update_layout(xaxis_rangeslider_visible=False)
    fig.update_layout(showlegend=False)
    fig.update_layout(margin=dict(l=10, r=70, b=50, t=10))
    fig.update_xaxes(
        visible=True,
        showticklabels=True,
        tickformat="%m/%d\n%H:%M",
        tickfont=dict(color="rgba(255,255,255,0.8)", size=10),
        gridcolor="rgba(255,255,255,0.1)",
        side="bottom",
    )
    fig.update_yaxes(
        visible=True,
        showticklabels=True,
        tickfont=dict(color="rgba(255,255,255,0.8)", size=10),
        gridcolor="rgba(255,255,255,0.1)",
        side="right",
        title_text="Price",
        title_font=dict(color="rgba(255,255,255,0.8)", size=10),
    )
    fig.update_layout(plot_bgcolor="rgba(0,0,0,0)")
    fig.update_layout(paper_bgcolor="rgba(12, 14, 18, 1)")
    fig.update_layout(font=dict(color="white"))

    fig.update_layout(width=args.width, height=args.height)

    if args.export_plotly and pos == args.window:
        out_path = os.path.join(SCRIPT_DIR, args.export_plotly) if not os.path.isabs(args.export_plotly) else args.export_plotly
        with open(out_path, "w") as f:
            f.write(fig.to_json())
        print(f"Exported Plotly figure to {out_path}")

    gif.append(fig_to_buffer(fig))

# save the gif
out_path = os.path.join(SCRIPT_DIR, args.out) if not os.path.isabs(args.out) else args.out
imageio.mimsave(out_path, gif, duration=1)
print(f"Saved {out_path} ({len(gif)} frames)")
