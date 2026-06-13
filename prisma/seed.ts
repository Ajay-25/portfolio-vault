/**
 * prisma/seed.ts
 *
 * Seeds the database with your portfolio data from the original dashboard.
 * Run: npm run db:seed
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // ── Create portfolios ────────────────────────────────────────────────────
  const myPortfolio = await prisma.portfolio.upsert({
    where:  { id: "portfolio-primary" },
    update: { ltcgUsed: 107000 },
    create: {
      id:      "portfolio-primary",
      name:    "My Portfolio",
      type:    "primary",
      taxSlab: 0.30,
      ltcgUsed: 107000,
    },
  });

  const momPortfolio = await prisma.portfolio.upsert({
    where:  { id: "portfolio-mom" },
    update: {},
    create: {
      id:      "portfolio-mom",
      name:    "Mother's Portfolio",
      type:    "secondary",
      taxSlab: 0.00, // tax exempt slab
    },
  });

  console.log(`✓ Portfolios: ${myPortfolio.name}, ${momPortfolio.name}`);

  // ── My Mutual Funds ─────────────────────────────────────────────────────
  const myFunds = [
    { schemeCode: "122639", schemeName: "Parag Parikh Flexi Cap Fund - Growth (Direct)",       units: 2800, sipAmount: 22000, sipDate: 7,  category: "Flexi" },
    { schemeCode: "118955", schemeName: "HDFC Flexi Cap Fund - Growth (Direct)",              units: 1100, sipAmount: 18000, sipDate: 7,  category: "Flexi" },
    { schemeCode: "118989", schemeName: "HDFC Mid Cap Fund - Growth (Direct)",                units: 850,  sipAmount: 17000, sipDate: 7,  category: "Mid"   },
    { schemeCode: "118778", schemeName: "Nippon India Small Cap Fund - Growth (Direct)",      units: 580,  sipAmount: 16000, sipDate: 7,  category: "Small" },
    { schemeCode: "120586", schemeName: "ICICI Prudential Large Cap Fund - Growth (Direct)", units: 3100, sipAmount: 12000, sipDate: 7,  category: "Large" },
    { schemeCode: "119775", schemeName: "Kotak Midcap Fund - Growth (Direct)",                units: 1550, sipAmount: 8000,  sipDate: 7,  category: "Mid"   },
    { schemeCode: "120684", schemeName: "ICICI Prudential Nifty Next 50 Index - Growth (Direct)", units: 480,  sipAmount: 12000, sipDate: 28, category: "Index" },
    { schemeCode: "149389", schemeName: "ICICI Prudential Nifty Midcap 150 Index - Growth (Direct)", units: 960,  sipAmount: 10000, sipDate: 28, category: "Index" },
    { schemeCode: "120620", schemeName: "ICICI Prudential Nifty 50 Index - Growth (Direct)",  units: 2600, sipAmount: 5000,  sipDate: 28, category: "Index" },
    { schemeCode: "120685", schemeName: "ICICI Prudential Gold ETF FOF - Growth (Direct)",    units: 1800, sipAmount: 5000,  sipDate: 28, category: "Gold"  },
  ];

  for (const fund of myFunds) {
    await prisma.mFHolding.upsert({
      where:  { portfolioId_schemeCode: { portfolioId: myPortfolio.id, schemeCode: fund.schemeCode } },
      update: { units: fund.units, schemeName: fund.schemeName, schemeCode: fund.schemeCode },
      create: { portfolioId: myPortfolio.id, ...fund },
    });
  }
  console.log(`✓ Your MF holdings: ${myFunds.length} funds`);

  // ── Mom's Mutual Funds ───────────────────────────────────────────────────
  const momFunds = [
    { schemeCode: "122639", schemeName: "Parag Parikh Flexi Cap Fund - Growth (Direct)",  units: 240,  sipAmount: 10000, sipDate: 7,  category: "Flexi"  },
    { schemeCode: "120251", schemeName: "ICICI Prudential Equity & Debt Fund - Growth (Direct)", units: 1050, sipAmount: 9000,  sipDate: 7,  category: "Hybrid" },
    { schemeCode: "147946", schemeName: "Bandhan Small Cap Fund - Growth (Direct)",       units: 2100, sipAmount: 7000,  sipDate: 28, category: "Small"  },
    { schemeCode: "119775", schemeName: "Kotak Midcap Fund - Growth (Direct)",            units: 210,  sipAmount: 5000,  sipDate: 28, category: "Mid"    },
    { schemeCode: "118968", schemeName: "HDFC Balanced Advantage Fund - Growth (Direct)", units: 0,    sipAmount: 4000,  sipDate: 28, category: "BAF"    },
  ];

  for (const fund of momFunds) {
    await prisma.mFHolding.upsert({
      where:  { portfolioId_schemeCode: { portfolioId: momPortfolio.id, schemeCode: fund.schemeCode } },
      update: { units: fund.units, schemeName: fund.schemeName, schemeCode: fund.schemeCode },
      create: { portfolioId: momPortfolio.id, ...fund },
    });
  }
  console.log(`✓ Mom's MF holdings: ${momFunds.length} funds`);

  // ── Indian Stocks (My Portfolio) ─────────────────────────────────────────
  const indianStocks = [
    { symbol: "LT",          displayName: "Larsen & Toubro",    qty: 74,  avgPrice: 3399.49, action: "HOLD · TRIM 30% APR 2027",    notes: "" },
    { symbol: "SIEMENS",     displayName: "Siemens",            qty: 38,  avgPrice: 2815.33, action: "HOLD · No add >₹3200",         notes: "" },
    { symbol: "HAL",         displayName: "HAL",                qty: 26,  avgPrice: 3984.85, action: "HOLD · Book >₹4800",           notes: "" },
    { symbol: "SHRIRAMFIN",  displayName: "Shriram Finance",   qty: 82,  avgPrice: 967.00,  action: "BUY MORE · Target ₹1420",      notes: "" },
    { symbol: "OLECTRA",     displayName: "Olectra Greentech", qty: 41,  avgPrice: 1224.91, action: "HOLD · Add <₹1100",            notes: "" },
    { symbol: "ADANIGREEN",  displayName: "Adani Green",        qty: 11,  avgPrice: 1588.25, action: "STOP-LOSS ₹900",               notes: "" },
    { symbol: "BEL",         displayName: "BEL",                qty: 13,  avgPrice: 307.36,  action: "BUILD TO ₹50K",                notes: "" },
    { symbol: "L&TFH",       displayName: "L&T Finance",        qty: 7,   avgPrice: 200.30,  action: "EXIT → Shriram",               notes: "" },
    { symbol: "LG",          displayName: "LG Electronics",    qty: 7,   avgPrice: 1140.00, action: "HOLD",                         notes: "" },
  ];

  for (const stock of indianStocks) {
    await prisma.stockHolding.upsert({
      where:  { portfolioId_symbol_exchange: { portfolioId: myPortfolio.id, symbol: stock.symbol, exchange: "NSE" } },
      update: { qty: stock.qty, avgPrice: stock.avgPrice, action: stock.action },
      create: { portfolioId: myPortfolio.id, exchange: "NSE", currency: "INR", ...stock },
    });
  }
  console.log(`✓ Indian stocks: ${indianStocks.length} holdings`);

  // ── US Stocks (My Portfolio) ─────────────────────────────────────────────
  const usStocks = [
    { symbol: "GOOGL", displayName: "Alphabet",   qty: 0.3789, avgPrice: 210.50, action: "HOLD", notes: "Google I/O AI rally"    },
    { symbol: "MRVL",  displayName: "Marvell",    qty: 0.6649, avgPrice: 82.48,  action: "HOLD", notes: "AI chip +127%"          },
    { symbol: "MSFT",  displayName: "Microsoft",  qty: 0.2738, avgPrice: 509.81, action: "HOLD", notes: "Bought near ATH"        },
    { symbol: "AMZN",  displayName: "Amazon",     qty: 0.6314, avgPrice: 227.38, action: "HOLD", notes: "AI cloud growth"        },
    { symbol: "META",  displayName: "Meta",       qty: 0.1470, avgPrice: 745.87, action: "HOLD", notes: "Below avg — hold"       },
    { symbol: "BABA",  displayName: "Alibaba",    qty: 0.9935, avgPrice: 155.55, action: "HOLD", notes: "China risk"             },
    { symbol: "NVDA",  displayName: "NVIDIA",     qty: 1.3075, avgPrice: 166.54, action: "HOLD", notes: "AI GPU leader"          },
    { symbol: "TSM",   displayName: "TSMC",       qty: 0.8676, avgPrice: 270.71, action: "BUY",  notes: "Strong Buy"             },
    { symbol: "AMD",   displayName: "AMD",        qty: 0.3249, avgPrice: 184.10, action: "HOLD", notes: "AI chip rally"          },
  ];

  for (const stock of usStocks) {
    await prisma.stockHolding.upsert({
      where:  { portfolioId_symbol_exchange: { portfolioId: myPortfolio.id, symbol: stock.symbol, exchange: "NYSE" } },
      update: { qty: stock.qty, avgPrice: stock.avgPrice },
      create: { portfolioId: myPortfolio.id, exchange: "NYSE", currency: "USD", ...stock },
    });
  }
  console.log(`✓ US stocks: ${usStocks.length} holdings`);

  // ── Nifty Triggers ───────────────────────────────────────────────────────
  const triggers = [
    { label: "T1", niftyLevel: 21000, deployAmount: 100000, condition: "below" },
    { label: "T2", niftyLevel: 19500, deployAmount: 200000, condition: "below" },
    { label: "T3", niftyLevel: 18000, deployAmount: 300000, condition: "below" },
  ];
  for (const t of triggers) {
    await prisma.trigger.upsert({
      where:  { id: `trigger-${t.label.toLowerCase()}` },
      update: {},
      create: { id: `trigger-${t.label.toLowerCase()}`, ownerId: "primary", ...t },
    });
  }
  console.log(`✓ Nifty triggers: T1, T2, T3`);

  // ── Action Items ─────────────────────────────────────────────────────────
  const actionItems = [
    {
      id: "action-exit-ltfh",
      ownerId: "primary",
      title: "Exit L&T Finance",
      description: "Move proceeds to Shriram Finance",
      priority: "high",
      bucket: "immediate",
    },
    {
      id: "action-adani-sl",
      ownerId: "primary",
      title: "Review Adani Green stop-loss",
      description: "Stop-loss set at ₹900",
      priority: "high",
      bucket: "immediate",
    },
    {
      id: "action-hal-book",
      ownerId: "primary",
      title: "Book HAL profits at ₹4800",
      description: "Set limit sell order",
      priority: "high",
      bucket: "immediate",
    },
    {
      id: "action-emergency-fund",
      ownerId: "primary",
      title: "Build Emergency Fund to ₹3L",
      description:
        "Reduce SIP by ₹25K/month for 6 months. Open Sweep FD at bank or Arbitrage Fund.",
      priority: "high",
      bucket: "immediate",
    },
    {
      id: "action-shriram-buy",
      ownerId: "primary",
      title: "Shriram Finance — 60 more shares target",
      description: "82 shares held. Buy 30 at ₹920-930, final 30 at ₹900-920.",
      priority: "medium",
      bucket: "pending",
    },
    {
      id: "action-mom-baf",
      ownerId: "primary",
      title: "Mother's HDFC BAF — Start SIP",
      description: "₹4,000/month on 28th · ISIN: INF179K01ZU9",
      priority: "medium",
      bucket: "pending",
    },
    {
      id: "action-apr-review",
      ownerId: "primary",
      title: "April 2027 — Annual Review + LTCG Harvest",
      description:
        "Step up SIP +10%. Harvest ₹1.25L LTCG in both PANs. Trim L&T stock 25-30%.",
      priority: "low",
      bucket: "longterm",
    },
    {
      id: "action-home-loan",
      ownerId: "primary",
      title: "Monitor Home Loan Rate",
      description:
        "RBI MPC watch. Current rate ~7.5%. Each 25bps hike = +₹2,100 EMI.",
      priority: "low",
      bucket: "longterm",
    },
  ];

  for (const item of actionItems) {
    await prisma.actionItem.upsert({
      where: { id: item.id },
      update: {
        title: item.title,
        description: item.description,
        priority: item.priority,
        bucket: item.bucket,
        completed: false,
      },
      create: item,
    });
  }
  console.log(`✓ Action items seeded: ${actionItems.length}`);

  // ── Fixed Income ─────────────────────────────────────────────────────────
  const myFI = [
    {
      id:            "fi-mine-ppf",
      type:          "ppf",
      label:         "PPF Account",
      institution:   "SBI Bank",
      accountNumber: "XXXXXXXXX4827",
      principal:     150000,
      currentValue:  840000,
      valueAsOf:     new Date("2026-05-01"),
      rate:          7.1,
      startDate:     new Date("2018-04-01"),
      maturityDate:  new Date("2033-04-01"),
      annualContrib: 150000,
      taxBenefit:    "EEE",
      extensionCount: 0,
      ppfWithdrawalAvailable: 420000,
      notes:         "Invest before 5th of month for max interest",
    },
    {
      id:              "fi-mine-epf",
      type:            "epf",
      label:           "EPF Account",
      institution:     "EPFO",
      accountNumber:   "100-XXXXXXXX-XX",
      uan:             "100XXXXXXXXX",
      principal:       200000,
      currentValue:    200000,
      valueAsOf:       new Date("2026-05-01"),
      rate:            8.25,
      monthlyContrib:  5000,
      employeeMonthly: 5000,
      employerMonthly: 1835,
      epsBalance:      45000,
      employerName:    "Acme Technologies Pvt Ltd",
      taxBenefit:      "EEE",
    },
    {
      id:               "fi-mine-nps1",
      type:             "nps_tier1",
      label:            "NPS Tier I",
      institution:      "PFRDA",
      pran:             "11XXXXXXXXXX",
      principal:        200000,
      currentValue:     200000,
      valueAsOf:        new Date("2026-05-01"),
      fundManager:      "SBI Pension Funds",
      investmentChoice: "active",
      equityPct:        60,
      corpBondPct:      30,
      govtSecPct:       8,
      altPct:           2,
      monthlyContrib:   6000,
      annualContrib:    72000,
      taxBenefit:       "80CCD",
      notes:            "Additional 80CCD(1B) benefit of ₹50,000 beyond 80C limit",
    },
  ];

  const myFDs = [
    {
      id:              "fi-mine-fd1",
      type:            "fd",
      label:           "HDFC FD",
      institution:     "HDFC Bank",
      accountNumber:   "HDFC-2024-8821",
      principal:       200000,
      rate:            7.25,
      startDate:       new Date("2025-06-19"),
      maturityDate:    new Date("2026-06-19"),
      maturityAmount:  214500,
      compoundingFreq: "quarterly",
      interestPayout:  "cumulative",
      autoRenewal:     false,
      isTaxSaving:     false,
      taxBenefit:      "taxable",
    },
    {
      id:              "fi-mine-fd2",
      type:            "fd",
      label:           "SBI Tax-Saving FD",
      institution:     "SBI",
      accountNumber:   "SBI-TS-2023-4412",
      principal:       150000,
      rate:            7.0,
      startDate:       new Date("2023-12-01"),
      maturityDate:    new Date("2028-12-01"),
      maturityAmount:  211350,
      compoundingFreq: "quarterly",
      interestPayout:  "cumulative",
      autoRenewal:     false,
      isTaxSaving:     true,
      taxBenefit:      "80C",
      notes:           "5-year lock-in. Cannot withdraw early.",
    },
    {
      id:              "fi-mine-fd3",
      type:            "fd",
      label:           "Bajaj Finance FD",
      institution:     "Bajaj Finance",
      accountNumber:   "BFL-2025-7731",
      principal:       300000,
      rate:            7.75,
      startDate:       new Date("2025-03-01"),
      maturityDate:    new Date("2027-03-01"),
      maturityAmount:  349200,
      compoundingFreq: "annual",
      interestPayout:  "cumulative",
      autoRenewal:     true,
      isTaxSaving:     false,
      taxBenefit:      "taxable",
      rating:          "AAA",
      notes:           "NBFC FD. Higher rate. DICGC not applicable.",
    },
  ];

  const myBonds = [
    {
      id:              "fi-mine-nsc",
      type:            "nsc",
      label:           "NSC VIII Issue",
      institution:     "Post Office",
      principal:       150000,
      rate:            7.7,
      startDate:       new Date("2023-03-01"),
      maturityDate:    new Date("2028-03-01"),
      maturityAmount:  216450,
      couponFrequency: "annual",
      taxBenefit:      "80C",
      notes:           "Interest taxable but qualifies for 80C each year as deemed reinvestment",
    },
    {
      id:              "fi-mine-bond",
      type:            "bond",
      label:           "HDFC NCD",
      institution:     "HDFC Ltd",
      isin:            "INE001A07QP1",
      principal:       150000,
      rate:            8.1,
      startDate:       new Date("2024-09-01"),
      maturityDate:    new Date("2028-09-01"),
      couponFrequency: "annual",
      nextCouponDate:  new Date("2026-09-01"),
      rating:          "AAA",
      taxBenefit:      "taxable",
    },
  ];

  const myLiquid = [
    {
      id:           "fi-mine-savings",
      type:         "liquid",
      label:        "HDFC Savings Account",
      institution:  "HDFC Bank",
      principal:    350000,
      currentValue: 350000,
      rate:         3.5,
      taxBenefit:   "taxable",
      notes:        "Emergency fund — keep at ₹3-5L",
    },
    {
      id:           "fi-mine-liquid-mf",
      type:         "liquid",
      label:        "Parag Parikh Liquid Fund",
      institution:  "PPFAS AMC",
      principal:    120000,
      currentValue: 120000,
      rate:         7.2,
      taxBenefit:   "taxable",
      notes:        "T+1 redemption. Better than savings account.",
    },
  ];

  const allMyFI = [...myFI, ...myFDs, ...myBonds, ...myLiquid];
  for (const item of allMyFI) {
    await prisma.fixedIncomeHolding.upsert({
      where:  { id: item.id },
      update: {},
      create: { ...item, portfolioId: myPortfolio.id },
    });
  }
  console.log(`✓ My fixed income: ${allMyFI.length} instruments`);

  const momFI = [
    {
      id:            "fi-mom-ppf",
      type:          "ppf",
      label:         "PPF Account",
      institution:   "Post Office",
      principal:     100000,
      currentValue:  280000,
      valueAsOf:     new Date("2026-05-01"),
      rate:          7.1,
      startDate:     new Date("2015-04-01"),
      maturityDate:  new Date("2030-04-01"),
      annualContrib: 100000,
      extensionCount: 0,
      taxBenefit:    "EEE",
    },
    {
      id:              "fi-mom-fd1",
      type:            "fd",
      label:           "SBI Senior Citizen FD",
      institution:     "SBI",
      principal:       300000,
      rate:            7.75,
      startDate:       new Date("2025-01-01"),
      maturityDate:    new Date("2026-12-31"),
      maturityAmount:  349000,
      compoundingFreq: "quarterly",
      interestPayout:  "monthly",
      autoRenewal:     true,
      taxBenefit:      "taxable",
      notes:           "Monthly payout for household income",
    },
    {
      id:              "fi-mom-scss",
      type:            "scss",
      label:           "Senior Citizens Savings Scheme",
      institution:     "Post Office",
      principal:       500000,
      rate:            8.2,
      startDate:       new Date("2023-07-01"),
      maturityDate:    new Date("2028-07-01"),
      couponFrequency: "quarterly",
      taxBenefit:      "80C",
      notes:           "Quarterly payout. Max ₹30L limit. 80C deductible.",
    },
  ];

  for (const item of momFI) {
    await prisma.fixedIncomeHolding.upsert({
      where:  { id: item.id },
      update: {},
      create: { ...item, portfolioId: momPortfolio.id },
    });
  }
  console.log(`✓ Mother's fixed income: ${momFI.length} instruments`);

  // ── My Insurance Policies ─────────────────────────────────────────────────
  const myInsurance = [
    {
      type: "term",
      insurer: "HDFC Life",
      planName: "Click 2 Protect Super",
      policyNumber: "HDFC-TERM-001",
      startDate: new Date("2021-04-01"),
      policyEndDate: new Date("2051-04-01"),
      nextPremiumDate: new Date("2026-04-01"),
      sumAssured: 20000000,
      premium: 18000,
      premiumFrequency: "annual",
      totalPremiumPaid: 90000,
      isInvestmentLinked: false,
      riders: "Critical illness, Accidental death benefit",
      status: "active",
    },
    {
      type: "health",
      insurer: "Star Health",
      planName: "Comprehensive Family Floater",
      policyNumber: "STAR-HLTH-001",
      startDate: new Date("2023-06-15"),
      policyEndDate: new Date("2026-06-14"),
      nextPremiumDate: new Date("2026-06-15"),
      sumAssured: 500000,
      premium: 22000,
      premiumFrequency: "annual",
      totalPremiumPaid: 66000,
      isInvestmentLinked: false,
      membersCount: 3,
      memberNames: "Self, Spouse, Mother",
      noClaimBonus: 50000,
      status: "active",
    },
    {
      type: "ulip",
      insurer: "HDFC Life",
      planName: "ProGrowth Plus",
      policyNumber: "HDFC-ULIP-001",
      startDate: new Date("2015-07-01"),
      premiumEndDate: new Date("2022-07-01"),
      policyEndDate: new Date("2030-07-01"),
      sumAssured: 750000,
      premium: 75000,
      premiumFrequency: "annual",
      totalPremiumPaid: 525000,
      isInvestmentLinked: true,
      currentFundValue: 950000,
      fundValueAsOf: new Date("2026-05-01"),
      fundType: "equity",
      status: "paid_up",
      notes: "Premium payment complete. Fund grows till Jul 2030 maturity.",
    },
  ];

  for (const policy of myInsurance) {
    const id = `insurance-mine-${policy.policyNumber ?? policy.planName.replace(/\s+/g, "-")}`;
    await prisma.insurancePolicy.upsert({
      where: { id },
      update: { currentFundValue: policy.currentFundValue },
      create: {
        id,
        portfolioId: myPortfolio.id,
        ...policy,
      },
    });
  }
  console.log(`✓ My insurance: ${myInsurance.length} policies`);

  // ── Mother's Insurance ───────────────────────────────────────────────────
  const momInsurance = [
    {
      type: "health",
      insurer: "Niva Bupa",
      planName: "Reassure Individual",
      policyNumber: "NIVA-MOM-001",
      startDate: new Date("2024-01-01"),
      policyEndDate: new Date("2027-01-01"),
      nextPremiumDate: new Date("2027-01-01"),
      sumAssured: 1000000,
      premium: 28000,
      premiumFrequency: "annual",
      totalPremiumPaid: 56000,
      isInvestmentLinked: false,
      membersCount: 1,
      memberNames: "Mother",
      status: "active",
    },
    {
      type: "endowment",
      insurer: "LIC",
      planName: "New Jeevan Anand",
      policyNumber: "LIC-MOM-001",
      startDate: new Date("2010-04-01"),
      premiumEndDate: new Date("2030-04-01"),
      policyEndDate: new Date("2035-04-01"),
      nextPremiumDate: new Date("2026-04-01"),
      sumAssured: 500000,
      premium: 28000,
      premiumFrequency: "annual",
      totalPremiumPaid: 448000,
      isInvestmentLinked: true,
      currentFundValue: 520000,
      fundValueAsOf: new Date("2026-01-01"),
      guaranteedMaturity: 850000,
      status: "active",
      notes: "Traditional endowment. Bonus accruing annually.",
    },
  ];

  for (const policy of momInsurance) {
    const id = `insurance-mom-${policy.policyNumber ?? policy.planName.replace(/\s+/g, "-")}`;
    await prisma.insurancePolicy.upsert({
      where: { id },
      update: { currentFundValue: policy.currentFundValue },
      create: {
        id,
        portfolioId: momPortfolio.id,
        ...policy,
      },
    });
  }
  console.log(`✓ Mother's insurance: ${momInsurance.length} policies`);

  // ══════════════════════════════════════════════════════════════════════════
  // HOME PROJECT
  // ══════════════════════════════════════════════════════════════════════════
  const home = await prisma.project.upsert({
    where:  { id: "project-home" },
    update: {},
    create: {
      id:          "project-home",
      name:        "HOME — Flat Purchase & Setup",
      type:        "home",
      description: "Flat purchase plus all setup work to make it livable",
      address:     "New flat",
      status:      "ongoing",
    },
  });

  const payers = [
    { id: "payer-me",   name: "Me",             relationship: "self",           isSelf: true  },
    { id: "payer-wife", name: "Wife",           relationship: "spouse",         isSelf: true  },
    { id: "payer-fil",  name: "Father-in-law",  relationship: "father_in_law",  isSelf: false },
    { id: "payer-mil",  name: "Mother-in-law",  relationship: "mother_in_law",  isSelf: false },
  ];
  for (const p of payers) {
    await prisma.payer.upsert({
      where: { id: p.id },
      update: {},
      create: { ...p, projectId: home.id },
    });
  }

  const streams = [
    { id: "ws-flat",   name: "Flat Purchase",    category: "purchase",   icon: "building",         sortOrder: 1 },
    { id: "ws-loan",   name: "Home Loan",        category: "loan",       icon: "building-bank",    sortOrder: 2 },
    { id: "ws-fees",   name: "Purchase Fees",    category: "fees",       icon: "file-text",        sortOrder: 3 },
    { id: "ws-sofa",   name: "Sofa",             category: "furniture",  icon: "sofa",             sortOrder: 4 },
    { id: "ws-carp",   name: "Carpentry",        category: "furniture",  icon: "ruler",            sortOrder: 5 },
    { id: "ws-stone",  name: "Stone Work",       category: "stonework",  icon: "diamond",          sortOrder: 6 },
    { id: "ws-ac",     name: "AC & Appliances",  category: "appliances", icon: "air-conditioning", sortOrder: 7 },
    { id: "ws-gates",  name: "Gates & Fittings", category: "gates",      icon: "door",             sortOrder: 8 },
    { id: "ws-panels", name: "Panels & Misc",    category: "panels",     icon: "layout-grid",      sortOrder: 9 },
    { id: "ws-utils",  name: "Utilities",        category: "utilities",  icon: "bolt",             sortOrder: 10 },
  ];
  for (const s of streams) {
    await prisma.workStream.upsert({
      where: { id: s.id },
      update: {},
      create: { ...s, projectId: home.id },
    });
  }

  const lineItems = [
    { id: "li-sofa-carp",    workStreamId: "ws-sofa",  name: "Sofa carpenter labour", vendor: "Carpenter",      status: "part_paid" },
    { id: "li-sofa-maker",   workStreamId: "ws-sofa",  name: "Sofa maker (installer)", vendor: "Sofa maker",    status: "part_paid" },
    { id: "li-sofa-cloth",   workStreamId: "ws-sofa",  name: "Sofa cloth (Mumbai)",   vendor: "Mumbai vendor",  status: "completed" },
    { id: "li-sofa-foam",    workStreamId: "ws-sofa",  name: "Foam",                  vendor: "Foam supplier",  status: "part_paid" },
    { id: "li-sofa-hw",      workStreamId: "ws-sofa",  name: "Sofa hardware goods",   vendor: "Hardware shop",  status: "completed" },
    { id: "li-carp-bed",     workStreamId: "ws-carp",  name: "Queen bed",             vendor: "Carpenter",      status: "advance_paid" },
    { id: "li-carp-ws",      workStreamId: "ws-carp",  name: "Workstation",           vendor: "Carpenter",      status: "advance_paid" },
    { id: "li-carp-cloth",   workStreamId: "ws-carp",  name: "Cloth box",             vendor: "Carpenter",      status: "advance_paid" },
    { id: "li-carp-shoe",    workStreamId: "ws-carp",  name: "Shoe rack",             vendor: "Carpenter",      status: "advance_paid" },
    { id: "li-stone-temple", workStreamId: "ws-stone", name: "Temple stone work",     vendor: "Stone mason",    status: "completed" },
    { id: "li-stone-nano",   workStreamId: "ws-stone", name: "Nano white stone",      vendor: "Stone shop",     status: "completed" },
    { id: "li-stone-kitch",  workStreamId: "ws-stone", name: "Kitchen hob cut + gas hole", vendor: "Stone mason", status: "completed" },
    { id: "li-ac-haier",     workStreamId: "ws-ac",    name: "Haier Split AC",        vendor: "Electronics",    status: "completed" },
    { id: "li-ac-ogen",      workStreamId: "ws-ac",    name: "O-General Window AC",   vendor: "Electronics",    status: "completed" },
    { id: "li-ac-chimney",   workStreamId: "ws-ac",    name: "Chimney + Chulha",      vendor: "Appliance shop", status: "part_paid" },
    { id: "li-gate-1",       workStreamId: "ws-gates", name: "Steel gate 1",          vendor: "Gate maker",     status: "pending" },
    { id: "li-gate-2",       workStreamId: "ws-gates", name: "Steel gate 2 + lock",   vendor: "Gate maker",     status: "pending" },
    { id: "li-jaquar",       workStreamId: "ws-gates", name: "Jaquar bathroom fittings", vendor: "Jaquar dealer", status: "completed" },
    { id: "li-mica",         workStreamId: "ws-panels", name: "Mica & Acrylic (kitchen/TV/almira)", vendor: "Laminate shop", status: "completed" },
    { id: "li-igl",          workStreamId: "ws-utils", name: "IGL gas pipeline",      vendor: "IGL",            status: "completed" },
  ];
  for (const li of lineItems) {
    await prisma.lineItem.upsert({
      where: { id: li.id },
      update: {},
      create: li,
    });
  }

  await prisma.cashAdvance.upsert({
    where: { id: "adv-carp-mil" },
    update: {},
    create: {
      id:         "adv-carp-mil",
      payerId:    "payer-mil",
      projectId:  home.id,
      label:      "Carpenter cash float (via MIL)",
      totalGiven: 50000,
      notes:      "MIL gave cash advance to carpenter; to be repaid to MIL",
    },
  });

  await prisma.transaction.deleteMany({ where: { projectId: home.id } });
  await prisma.builderDeduction.deleteMany({ where: { projectId: home.id } });

  const txns = [
    { description: "Booking amount to builder",      amount: 500000, date: new Date("2025-06-15"), workStreamId: "ws-flat", paidByPayerId: "payer-me",  settlementType: "self", phase: "advance", paymentMode: "neft" },
    { description: "Agreement & registration fees",  amount: 85000,  date: new Date("2025-08-01"), workStreamId: "ws-fees", paidByPayerId: "payer-me",  settlementType: "self", phase: "full",    paymentMode: "neft" },
    { description: "Home loan processing fee",       amount: 12000,  date: new Date("2025-09-10"), workStreamId: "ws-loan", paidByPayerId: "payer-me",  settlementType: "self", phase: "full",    paymentMode: "netbanking" },
    { description: "Builder instalment 1",           amount: 800000, date: new Date("2025-12-20"), workStreamId: "ws-flat", paidByPayerId: "payer-fil", settlementType: "repayable", phase: "part", paymentMode: "neft" },
    { description: "Sofa cloth payment (Mumbai)", amount: 18000, date: new Date("2026-03-10"), workStreamId: "ws-sofa", lineItemId: "li-sofa-cloth", paidByPayerId: "payer-me",  settlementType: "self", phase: "full",    paymentMode: "upi" },
    { description: "Sofa cloth delivery (bhada)",  amount: 1200,  date: new Date("2026-03-12"), workStreamId: "ws-sofa", lineItemId: "li-sofa-cloth", paidByPayerId: "payer-me",  settlementType: "self", phase: "full",    paymentMode: "cash" },
    { description: "Carpenter advance",            amount: 25000, date: new Date("2026-03-05"), workStreamId: "ws-sofa", lineItemId: "li-sofa-carp",  paidByPayerId: "payer-mil", settlementType: "repayable", phase: "advance", paymentMode: "cash", cashAdvanceId: "adv-carp-mil" },
    { description: "Carpenter part payment",       amount: 15000, date: new Date("2026-04-02"), workStreamId: "ws-sofa", lineItemId: "li-sofa-carp",  paidByPayerId: "payer-me",  settlementType: "self", phase: "part",    paymentMode: "upi" },
    { description: "Foam advance",                 amount: 8000,  date: new Date("2026-03-20"), workStreamId: "ws-sofa", lineItemId: "li-sofa-foam",  paidByPayerId: "payer-me",  settlementType: "self", phase: "advance", paymentMode: "upi" },
    { description: "Temple stone work",            amount: 35000, date: new Date("2026-02-15"), workStreamId: "ws-stone", lineItemId: "li-stone-temple", paidByPayerId: "payer-fil", settlementType: "gift", phase: "full", paymentMode: "cash" },
    { description: "Nano white stone for temple",  amount: 6000,  date: new Date("2026-02-18"), workStreamId: "ws-stone", lineItemId: "li-stone-nano",   paidByPayerId: "payer-me",  settlementType: "self", phase: "full", paymentMode: "cash" },
    { description: "Kitchen hob cut + gas hole",   amount: 4500,  date: new Date("2026-02-20"), workStreamId: "ws-stone", lineItemId: "li-stone-kitch",  paidByPayerId: "payer-fil", settlementType: "gift", phase: "full", paymentMode: "cash" },
    { description: "Haier Split AC",               amount: 42000, date: new Date("2026-04-10"), workStreamId: "ws-ac", lineItemId: "li-ac-haier", paidByPayerId: "payer-me",  settlementType: "self", phase: "full", paymentMode: "upi" },
    { description: "O-General Window AC",          amount: 38000, date: new Date("2026-04-12"), workStreamId: "ws-ac", lineItemId: "li-ac-ogen",  paidByPayerId: "payer-fil", settlementType: "repayable", phase: "full", paymentMode: "credit_card", paidBy_card: "FIL HDFC card" },
    { description: "Chimney + Chulha advance",     amount: 10000, date: new Date("2026-04-15"), workStreamId: "ws-ac", lineItemId: "li-ac-chimney", paidByPayerId: "payer-me",  settlementType: "self", phase: "advance", paymentMode: "upi" },
    { description: "Carpenter advance (cash)",     amount: 30000, date: new Date("2026-04-20"), workStreamId: "ws-carp", lineItemId: "li-carp-bed", paidByPayerId: "payer-me",  settlementType: "self", phase: "advance", paymentMode: "cash" },
    { description: "Carpenter part payment (UPI)", amount: 20000, date: new Date("2026-05-01"), workStreamId: "ws-carp", lineItemId: "li-carp-bed", paidByPayerId: "payer-me",  settlementType: "self", phase: "part", paymentMode: "upi" },
    { description: "Jaquar bathroom fittings",     amount: 28000, date: new Date("2026-01-20"), workStreamId: "ws-gates", lineItemId: "li-jaquar", paidByPayerId: "payer-me",  settlementType: "self", phase: "full", paymentMode: "upi" },
    { description: "Mica & Acrylic (cash part)",   amount: 15000, date: new Date("2026-02-01"), workStreamId: "ws-panels", lineItemId: "li-mica", paidByPayerId: "payer-me",  settlementType: "self", phase: "part", paymentMode: "cash" },
    { description: "Mica & Acrylic (online part)", amount: 22000, date: new Date("2026-02-02"), workStreamId: "ws-panels", lineItemId: "li-mica", paidByPayerId: "payer-me",  settlementType: "self", phase: "part", paymentMode: "upi" },
    { description: "Mica delivery charge",         amount: 800,   date: new Date("2026-02-03"), workStreamId: "ws-panels", lineItemId: "li-mica", paidByPayerId: "payer-me",  settlementType: "self", phase: "full", paymentMode: "cash" },
    { description: "IGL gas pipeline connection",  amount: 6500,  date: new Date("2026-03-01"), workStreamId: "ws-utils", lineItemId: "li-igl", paidByPayerId: "payer-me",  settlementType: "self", phase: "full", paymentMode: "netbanking" },
  ];
  for (const t of txns) {
    await prisma.transaction.create({ data: { ...t, projectId: home.id } });
  }
  console.log(`✓ Home project: ${streams.length} work streams, ${lineItems.length} line items, ${txns.length} transactions`);

  const deductions = [
    { item: "Jaquar bathroom fittings", reason: "Builder was to install standard CP fittings", estimatedAmount: 15000, selfPaidAmount: 28000, status: "pending" },
    { item: "Custom chimney",           reason: "Builder was to provide basic chimney",        estimatedAmount: 12000, selfPaidAmount: 0,     status: "pending" },
    { item: "Kitchen/TV/Almira mica",   reason: "Builder laminate work declined",              estimatedAmount: 20000, selfPaidAmount: 37800, status: "pending" },
  ];
  for (const d of deductions) {
    await prisma.builderDeduction.create({ data: { ...d, projectId: home.id } });
  }
  console.log(`✓ Builder deductions: ${deductions.length} items`);

  // ── Net Worth Config (indianStocks override only) ────────────────────────
  const primaryPortfolio = await prisma.portfolio.findUnique({
    where: { id: "portfolio-primary" },
    include: { stockHoldings: true },
  });
  const indianValue = (primaryPortfolio?.stockHoldings ?? [])
    .filter((s) => s.currency === "INR" && s.exchange === "NSE")
    .reduce((sum, s) => sum + s.qty * s.avgPrice, 0);

  await prisma.netWorthConfig.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      indianStocks: indianValue || 696270,
      ppfBalance: 0,
      epfBalance: 0,
      npsBalance: 0,
      liquidBalance: 0,
    },
  });
  console.log(`✓ Net worth config seeded`);

  console.log("\n✅ Seed complete. Run: npm run dev");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
