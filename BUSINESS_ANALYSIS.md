# Motorburger — Business Analysis State

Read this first. Don't re-derive — these numbers and decisions are already settled.

## Historical P&L
| Year | Revenue | Food Cost % | Wages | Gross Profit | Net Income |
|---|---|---|---|---|---|
| 2022 | $311,709 | 35.5% | $41,134 | $154,200 | $36,229 |
| 2023 | $349,428 | 33.4% | $63,484 | $162,083 | $17,371* |
| 2024 | $349,649 | 38.1% | $63,110 | $147,703 | $8,916 |
| 2025 | $309,138 | 36.0% | $64,547 | $126,576 | $3,991 |

*2023 net understated — income shifted to personal for tax planning.

**Prime cost (food+labor) % of revenue:** 2022 48.7% → 2025 56.9%. Industry danger zone: 65%. Trending wrong direction but buffer remains.

## Root Cause (settled)
Revenue is flat/stable ($310–350K range) — NOT a sales problem. Margin collapse is **labor-driven**: wages +57% (2022→2025, $41K→$64.5K) while revenue grew ~0%. Food cost % held roughly steady. Merchant fees ($9.5K appearing 2024-25) confirmed as reclassification, not new cost — always existed, just uncategorized before. Sales tax expense spike = catch-up on existing liability, not new.

## 2026 Targets / Projections
| Scenario | Revenue | Gross Profit | Net Income |
|---|---|---|---|
| Volume growth only (current pace) | $352,725 | $171,573 | $48,988 |
| + Catering $40K + 3P delivery | $431,335 | $201,253 | $78,668 |
| + Pinsa conservative ($12K) | $443,335 | $209,653 | $87,068 |
| + Pinsa realistic ($25K) | $456,335 | $218,753 | $96,168 |

Current 2026 pace: ~$401K (ahead of base target).

## Pricing Update — Live as of late June 2026
New menu prices (tax-inclusive at 6% MI sales tax):
| Item | Sticker (gross) | Net (tax backed out) |
|---|---|---|
| Burger + fries combo | $20 | $18.87 |
| Solo fries | $7 | $6.60 |
| Poutine | $12 | $11.32 |

Note: previous burger prices were mostly $18–19, so this combo pricing is a smaller lift than the modeled $1.50–2/ticket reprice scenario (and includes fries in the bundle). Expect smaller realized gain than the $20K/yr reprice estimate — monitor actual ticket volume post-launch for elasticity effects (drink price increase earlier in 2026 saw attach rate drop 42%→22%, so watch combo/fries volume similarly for first 2-3 weeks).

## Three Open Decisions
1. **New hire** ($13,520/yr) — do NOT do in isolation. Prime cost goes 56.9%→61.1% without offsetting revenue. Must pair with #2 or #3.
2. **Menu reprice** (+$1.50–2/ticket avg) — HIGHEST CERTAINTY lever. ~$20K/yr added gross profit, zero added cost, applies to existing customers. Do this first.
3. **DoorDash/delivery** — realistic annual contribution $11,700–16,700/yr after commission + packaging (not the originally floated $29K). Roughly a wash against hire cost alone, not a clear standalone win. Ramp-up real: expect 2–3 orders/day first 60 days, not 8/day immediately.

**Recommended sequencing:** reprice first → confirm revenue lift holds → THEN reassess hire and/or DoorDash against the new, higher revenue base. Do not commit to hire before reprice is confirmed.

## Operational Flags
- **Go-Kart mischarge risk:** cashiers ring Go-Kart (kids' plain burger, ~$14.15) instead of Classic+cheese modifier under high volume. Jun 6: 44 Go-Karts vs avg 4–8 → ~36 mischarged, ~$180 lost. Needs cashier training on modifiers.
- **Capacity ceiling:** 160 sq ft container, ~130 proteins/service max throughput. Sat 5–6pm = absolute ceiling. Any new menu line (e.g. Pinsa) must be operationally isolated from burger line.
- **Bun par:** avg Sun 69 buns, avg Sat 129 buns. Par = peak expected day + 20% buffer.
- **Drink attach rate:** raised drink price to $5 (~Jun 5–7 2026) → attach rate dropped 42%→22%. Still monitoring for stabilization. Each 10% attach improvement on a 144-protein Saturday ≈ $66 extra revenue.
- **Poutine costing — IN PROGRESS.** Fries + curds costed below; gravy and container cost still pending (gravy to be costed on next stock batch purchase).

### Poutine cost breakdown (as of late June 2026)
**Cheese curds:** Restaurant Depot, $36.54 for 2× 5lb units (10lb total) = $3.654/lb = $0.00806/gram
**Fries (imported from Canada):** $36.25 CAD/case → $27.35 USD/case + $100 broker/border fee ÷ 20 cases = $5/case → $32.35/case landed. Case = 12kg → $2.696/kg = $0.002696/gram

| Component | Side poutine (upgrade) | Solo/regular poutine |
|---|---|---|
| Fries weight | 292g | 530g |
| Fries cost | $0.787 | $1.429 |
| Curds weight | 105–110g | 205–210g |
| Curds cost | $0.846–0.886 | $1.652–1.692 |
| **Subtotal (fries+curds only)** | **$1.63–1.67** | **$3.08–3.12** |

Gravy cost and container cost NOT YET included — will push food cost % up somewhat once added. Next stock batch purchase will provide gravy batch cost ÷ portions yielded.

## Data Sources / Inputs
- Square API: revenue, proteins, drink attach, DOW trends, annual tracker — live, no manual upload needed (handled by dashboard app)
- This chat's domain: food cost invoices, supplier pricing, OnPay wage data, Xero P&L exports, seasonal forecasting — anything Square doesn't track

## Weekly Check-in Workflow
1. Upload Square CSV if doing deep-dive outside dashboard (Reports → Item Sales)
2. Upload supplier invoice photos if delivery occurred
3. Upload Xero P&L export for monthly review
4. Ask: "Review this week vs benchmarks and flag anything worth noting"

## Workflow Rule
End of every session: update this file with what changed/was decided. Don't re-summarize conversation in chat — rewrite the relevant section here and re-upload to overwrite.
## Staff Compensation Analysis (as of Jul 2026)

### Tip pool benchmarks
- CC tips (Square): 9.3% of revenue 2-year avg (9.9% in 2025, 8.4% in 2026 YTD — dip likely tip fatigue post drink price increase)
- Cash tips (estimated): ~1.25% of sales = ~$3,864/yr (2025), not tracked in Square
- Total effective tip pool: ~10.5% of revenue

### Total compensation — 2026 annualized pace (wages + CC tips + est. cash tips)
| Name | Wages | Tips | Total | Eff/hr | Hrs/wk |
|---|---|---|---|---|---|
| Brian | $22,990 | $14,680 | $37,670 | $26.22 | 27.6 |
| Mitch | $25,871 | $16,567 | $42,437 | $27.89 | 29.3 |
| Brandy | $4,776 | $2,497 | $7,273 | $22.84 | 6.1 |
| Tory | $6,590 | $4,116 | $10,707 | $24.37 | 8.4 (leaving) |

### Detroit market context
- Detroit line cook median: $36,355/yr full-time
- Brian and Mitch are at or above market at part-time hours
- Tax advantage on tips (~$15K/yr unreported) makes effective comp equivalent to ~$50K W-2

### Wage decisions (pending)
- Mitch: requesting $17→$18. Approved in principle. Cost: $1,612/yr. Effective rate becomes $27.89→$28.89/hr
- Brian: should receive $16→$17 simultaneously. Cost: $1,612/yr. Closes $4,767 gap vs Mitch before it becomes a retention issue. Do not wait for Brian to raise it.
- Both bumps together: $3,224/yr additional labour. Labour % moves 14.5%→15.4% at $341K — fully absorbable.

### Tory leaving
- Averaged 6.5 hrs/wk, $15/hr, dual role Host + Line Cook
- Wage cost: ~$5,104/yr — small dollar impact but critical peak night coverage
- Replacement: one versatile hire (Host + Line Cook, $15/hr, 20-25 hrs/wk, Fri/Sat/Sun non-negotiable)
- Do NOT add separate prep hire simultaneously — prime cost hits 64.7% at $341K revenue
- Reassess dedicated prep hire when revenue confirms above $370K

### Mitch — IT career note
- Has IT education/interest. Entry IT pays $41-50K year 1 but fully taxed, 40hrs/wk, Mon-Fri
- At current comp Mitch is at or above entry IT parity at 29 hrs/wk with tax advantage
- Recommend: encourage CompTIA A+ cert on the side, transition when he has something lined up
- Give him the $1 now — buys 6-12 months stability