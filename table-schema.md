# Primary Supabase table schemas

Schema reference for the main tables used in the smart-money-concepts project.

---

## Market_candles_ewo

| Name | Format | Type | Description |
|------|--------|------|-------------|
| symbol | text | string | |
| timeframe | text | string | |
| timestamp | timestamp with time zone | string | |
| mean_price | numeric | number | |
| sma_5 | numeric | number | |
| sma_35 | numeric | number | |
| ewo | numeric | number | |
| open | numeric | number | |
| high | numeric | number | |
| low | numeric | number | |
| close | numeric | number | |
| volume | numeric | number | |
| trend_direction | text | string | |
| wave_number | text | string | |
| wave_phase | text | string | |
| wave_start_time | timestamp with time zone | string | |
| wave_peak_ewo | numeric | number | |
| wave_peak_price | numeric | number | |
| zero_cross_flag | boolean | boolean | |
| new_n_high_flag | boolean | boolean | |
| retrace_trigger_flag | boolean | boolean | |
| engine_reset_flag | boolean | boolean | |

---

## Market_candles

| Name | Format | Type | Description |
|------|--------|------|-------------|
| id | bigint | number | |
| symbol | text | string | |
| timeframe | text | string | |
| timestamp_utc | bigint | number | |
| eastern_time | timestamp with time zone | string | |
| open | numeric | number | |
| high | numeric | number | |
| low | numeric | number | |
| close | numeric | number | |
| volume | numeric | number | |
| atr | numeric | number | |
| created_at | timestamp with time zone | string | |
| trend_direction | text | string | |
| wave_number | text | string | |
| wave_phase | text | string | |
| wave_start_time | timestamp with time zone | string | |
| wave_peak_ewo | numeric | number | |
| wave_peak_price | numeric | number | |
| zero_cross_flag | boolean | boolean | |
| new_n_high_flag | boolean | boolean | |
| retrace_trigger_flag | boolean | boolean | |
| engine_reset_flag | boolean | boolean | |

---

## Wave_engine_state

| Name | Format | Type | Description |
|------|--------|------|-------------|
| symbol | text | string | |
| timeframe | text | string | |
| timestamp | timestamp with time zone | string | |
| trend_direction | text | string | |
| wave_number | text | string | |
| wave_phase | text | string | |
| wave_start_time | timestamp with time zone | string | |
| wave_peak_ewo | numeric | number | |
| wave_peak_price | numeric | number | |
| zero_cross_flag | boolean | boolean | |
| new_n_high_flag | boolean | boolean | |
| retrace_trigger_flag | boolean | boolean | |
| engine_reset_flag | boolean | boolean | |
