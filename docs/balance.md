# Flipside balance report

300 solo 30-day games per bot (same seeds), 75 fuzz games (1–4 hot-seat players, simple mode mixed in, 30/60/90 days), 300 30-year markets.

## Flip: buy-low/sell-high bot vs random play (start: $500 own + $1,500 loan)
| | Median net worth | Mean | Worst | Best |
|---|---|---|---|---|
| Buy-low/sell-high bot | $11,634 | $11,657 | $369 | $47,949 |
| Random play | -$1,581 | -$1,519 | -$2,413 | $371 |

The bot beat random play on the same seed in **100%** of games. It reached Tier 2 ($5,000) in 80% of games (median day 17) and Tier 3 in 31%.

## Invest: index fund vs random stock picking, 30 years, $1 in
| | Median | Mean | 10th pct | 90th pct |
|---|---|---|---|---|
| Index fund | 11.56× | 27.42× | 2.11× | 56.15× |
| One random stock | 2.10× | 63.72× | 0.05× | 55.55× |
| Three random stocks | 7.09× | 57.62× | 0.62× | 105.94× |

Index beat one random stock in **79%** of runs and three random stocks in **62%**. One random stock more than doubled the index in 13% of runs.

## Invariants: all passed
