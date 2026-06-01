import { MF_CATEGORY_HINT } from "@/lib/utils/mf-category";

export type AgentToolDefinition = {
  name:        string;
  description: string;
  parameters:  Record<string, unknown>;
};

export const AGENT_TOOLS = [
  {
    name:        "get_mf_returns",
    description: "Get mutual fund holdings with LIVE NAV and calculated returns vs average buy NAV. Use for MF gain/loss, negative returns, best/worst MF performers, or fund-level P&L.",
    parameters: {
      type:       "object",
      properties: {
        portfolio: {
          type:        "string",
          enum:        ["mine", "mother", "both"],
          description: "Which portfolio to include",
        },
        filter: {
          type:        "string",
          enum:        ["all", "negative", "positive"],
          description: "Filter by return: negative = funds in loss, positive = funds in profit",
        },
      },
    },
  },
  {
    name:        "get_fixed_income_returns",
    description: "Get fixed income holdings (PPF, EPF, NPS, FD, bonds, liquid) with principal, rate, maturity, and estimated accrued returns where rate and start date are available.",
    parameters: {
      type:       "object",
      properties: {
        portfolio: {
          type:        "string",
          enum:        ["mine", "mother", "both"],
          description: "Which portfolio to include",
        },
        filter: {
          type:        "string",
          enum:        ["all", "negative", "positive"],
          description: "Filter by estimated return",
        },
        type: {
          type:        "string",
          description: "Optional filter by type: ppf, epf, nps, fd, bond, liquid, sweep_fd",
        },
      },
    },
  },
  {
    name:        "get_insurance_investment_returns",
    description: "Get investment-linked insurance (ULIP, endowment, money-back) with premium paid vs current fund value and returns. Use for ULIP/endowment performance questions.",
    parameters: {
      type:       "object",
      properties: {
        portfolio: {
          type:        "string",
          enum:        ["mine", "mother", "both"],
          description: "Which portfolio to include",
        },
        filter: {
          type:        "string",
          enum:        ["all", "negative", "positive"],
          description: "Filter by return on premium paid",
        },
      },
    },
  },
  {
    name:        "get_investment_returns",
    description: "Get returns across ALL asset classes (stocks, MF, fixed income, insurance) in one call. Use when user asks about overall losers/winners or negative returns across the whole portfolio.",
    parameters: {
      type:       "object",
      properties: {
        portfolio: {
          type:        "string",
          enum:        ["mine", "mother", "both"],
          description: "Which portfolio to include",
        },
        filter: {
          type:        "string",
          enum:        ["all", "negative", "positive"],
          description: "Filter by return across asset classes",
        },
        asset_class: {
          type:        "string",
          enum:        ["all", "stocks", "mf", "fixed_income", "insurance"],
          description: "Limit to one asset class, or all for combined view",
        },
      },
    },
  },
  {
    name:        "get_stock_returns",
    description: "Get stock holdings with LIVE market prices (CMP) and calculated unrealized returns vs average buy price. Use for questions about negative/positive returns, best/worst performers, P&L, gain %, or which stocks are in loss.",
    parameters: {
      type:       "object",
      properties: {
        portfolio: {
          type:        "string",
          enum:        ["mine", "mother", "both"],
          description: "Which portfolio to include",
        },
        filter: {
          type:        "string",
          enum:        ["all", "negative", "positive"],
          description: "Filter by return: negative = stocks in loss, positive = stocks in profit",
        },
      },
    },
  },
  {
    name:        "get_portfolio_summary",
    description: "READ-ONLY summary of portfolio totals (MF + stocks + fixed income + insurance). Does NOT modify data. To remove or edit fixed income use delete_fixed_income / update_fixed_income. To edit stocks/MF use update_stock_holding / update_mf_holding.",
    parameters: {
      type:       "object",
      properties: {
        portfolio: {
          type:        "string",
          enum:        ["mine", "mother", "both"],
          description: "Which portfolio to summarize",
        },
      },
      required: ["portfolio"],
    },
  },
  {
    name:        "get_upcoming_sips",
    description: "Get upcoming SIP payments with dates and amounts. Use this to remind about SIPs or help update units after deduction.",
    parameters: {
      type:       "object",
      properties: {},
    },
  },
  {
    name:        "get_action_items",
    description: "Get open action items / todos.",
    parameters: {
      type:       "object",
      properties: {
        include_completed: {
          type:        "boolean",
          description: "Whether to include completed items",
        },
      },
    },
  },
  {
    name:        "get_nav",
    description: "Get the latest NAV for a mutual fund scheme.",
    parameters: {
      type:       "object",
      properties: {
        scheme_code: {
          type:        "string",
          description: "AMFI scheme code e.g. 122639",
        },
      },
      required: ["scheme_code"],
    },
  },
  {
    name:        "find_mf_holdings",
    description: "Search MF holdings by scheme code, fund name keyword, or ISIN. ALWAYS call this before update_mf_holding or add_mf_holding to confirm the correct scheme_code and portfolio (mine vs mother).",
    parameters: {
      type:       "object",
      properties: {
        portfolio: {
          type:        "string",
          enum:        ["mine", "mother", "both"],
          description: "Default both — narrow to mine or mother when user specifies",
        },
        scheme_code: {
          type:        "string",
          description: "Exact AMFI scheme code",
        },
        keyword: {
          type:        "string",
          description: "Partial fund name e.g. Parag Parikh, HDFC Midcap",
        },
        isin: {
          type:        "string",
          description: "ISIN to locate the fund",
        },
      },
    },
  },
  {
    name:        "update_mf_holding",
    description: "Patch an EXISTING MF holding — only pass fields you intend to change (units, avg_nav, sip_amount, sip_date, category). Other fields are preserved. Requires scheme_code + portfolio. Use find_mf_holdings first if unsure. Never use add_mf_holding for SIP or unit updates.",
    parameters: {
      type:       "object",
      properties: {
        scheme_code: { type: "string", description: "AMFI scheme code from find_mf_holdings" },
        portfolio:   { type: "string", enum: ["mine", "mother"], description: "Required — default mine unless user said mother/mom" },
        units:       { type: "number", description: "New unit balance (only if changing units)" },
        avg_nav:     { type: "number", description: "Average purchase NAV (only if changing)" },
        sip_amount:  { type: "number", description: "Monthly SIP ₹ (only if changing SIP)" },
        sip_date:    { type: "number", description: "SIP day: 7 or 28 (only if changing)" },
        category:    { type: "string", description: MF_CATEGORY_HINT },
      },
      required: ["scheme_code", "portfolio"],
    },
  },
  {
    name:        "update_mf_units",
    description: "Update unit count only for an existing MF holding. Prefer update_mf_holding. Requires scheme_code + portfolio.",
    parameters: {
      type:       "object",
      properties: {
        scheme_code: {
          type:        "string",
          description: "AMFI scheme code",
        },
        new_units: {
          type:        "number",
          description: "New total unit balance",
        },
        portfolio: {
          type:        "string",
          enum:        ["mine", "mother"],
          description: "Which portfolio — default mine unless user said mother",
        },
      },
      required: ["scheme_code", "new_units", "portfolio"],
    },
  },
  {
    name:        "resolve_mf_category",
    description: "Identify the MF category for a fund from its name and/or Excel hint. Registers a new category label in the system if it does not exist yet. Use before import when category is missing or unclear — bulk_add_mf_holdings also auto-resolves categories.",
    parameters: {
      type:       "object",
      properties: {
        scheme_name: {
          type:        "string",
          description: "Full mutual fund name",
        },
        category_hint: {
          type:        "string",
          description: "Optional category from spreadsheet e.g. Debt, Liquid, Corporate Bond",
        },
      },
      required: ["scheme_name"],
    },
  },
  {
    name:        "lookup_mf_scheme",
    description: "Look up AMFI scheme code(s) from ISIN, fund name, or existing code. Use when Excel/CAS rows have ISIN or name but no scheme code. Prefer ISIN when available — most reliable.",
    parameters: {
      type:       "object",
      properties: {
        isin: {
          type:        "string",
          description: "Growth or dividend ISIN e.g. INF109K016B1",
        },
        name: {
          type:        "string",
          description: "Fund name e.g. ICICI Prudential Corporate Bond Fund",
        },
        scheme_code: {
          type:        "string",
          description: "Optional — verify an existing AMFI code",
        },
      },
    },
  },
  {
    name:        "bulk_add_mf_holdings",
    description: "Import many MF holdings from Excel/CSV after delete_all or initial load. For single-fund SIP/unit edits use update_mf_holding. Only overwrites fields present in each row; existing holdings are patched, not replaced with zeros.",
    parameters: {
      type:       "object",
      properties: {
        portfolio: {
          type:        "string",
          enum:        ["mine", "mother"],
          description: "Target portfolio",
        },
        holdings: {
          type:        "array",
          description: "Rows to import — scheme_code optional if isin or scheme_name provided",
          items: {
            type:       "object",
            properties: {
              scheme_name:  { type: "string", description: "Fund name from spreadsheet" },
              units:        { type: "number", description: "Unit balance" },
              isin:         { type: "string", description: "ISIN if available — used for lookup" },
              scheme_code:  { type: "string", description: "AMFI code if already known" },
              avg_nav:      { type: "number", description: "Average purchase NAV" },
              sip_amount:   { type: "number", description: "Monthly SIP amount" },
              sip_date:     { type: "number", description: "SIP date: 7 or 28" },
              category:     { type: "string", description: MF_CATEGORY_HINT },
            },
            required: ["scheme_name", "units"],
          },
        },
      },
      required: ["portfolio", "holdings"],
    },
  },
  {
    name:        "add_mf_holding",
    description: "CREATE a new MF holding only — fails if scheme_code already exists in that portfolio. For SIP/units/avg NAV changes on existing funds use update_mf_holding. Call find_mf_holdings first to avoid duplicates.",
    parameters: {
      type:       "object",
      properties: {
        scheme_code: { type: "string", description: "AMFI scheme code (optional if isin provided)" },
        isin:        { type: "string", description: "ISIN — auto-resolves to AMFI code" },
        scheme_name: { type: "string", description: "Full scheme name" },
        units:       { type: "number", description: "Number of units" },
        avg_nav:     { type: "number", description: "Average NAV / purchase price" },
        sip_amount:  { type: "number", description: "Monthly SIP amount (0 if lump sum)" },
        sip_date:    { type: "number", description: "SIP date: 7 or 28" },
        category:    { type: "string", description: MF_CATEGORY_HINT },
        portfolio:   { type: "string", enum: ["mine", "mother"] },
      },
      required: ["scheme_name", "units", "portfolio"],
    },
  },
  {
    name:        "delete_mf_holding",
    description: "Delete a single MF holding. First call WITHOUT confirmed:true to show details and ask user; call again with confirmed:true only after explicit user approval.",
    parameters: {
      type:       "object",
      properties: {
        scheme_code: { type: "string" },
        portfolio:   { type: "string", enum: ["mine", "mother"] },
        confirmed:   {
          type:        "boolean",
          description: "Must be true only after user explicitly confirms deletion",
        },
      },
      required: ["scheme_code", "portfolio"],
    },
  },
  {
    name:        "delete_all_mf_holdings",
    description: "Delete ALL MF holdings in a portfolio. First call WITHOUT confirmed:true to preview list; call again with confirmed:true only after explicit user approval.",
    parameters: {
      type:       "object",
      properties: {
        portfolio: {
          type:        "string",
          enum:        ["mine", "mother", "both"],
          description: "Which portfolio(s) to clear",
        },
        confirmed: {
          type:        "boolean",
          description: "Must be true only after user explicitly confirms",
        },
      },
      required: ["portfolio"],
    },
  },
  {
    name:        "lookup_stock_symbol",
    description: "Search NSE/NYSE ticker from company name or wrong/abbreviated symbol. Use when live CMP fails (price not found) or before fixing a holding's symbol. Returns candidates with live price verification — confirm with user before update_stock_holding.",
    parameters: {
      type:       "object",
      properties: {
        query: {
          type:        "string",
          description: "Wrong symbol or abbreviation e.g. BHARAT ELECTRONICS, HINDAERONAUTICS, NIPIND",
        },
        name: {
          type:        "string",
          description: "Full company name e.g. Bharat Electronics Limited",
        },
        exchange: {
          type:        "string",
          enum:        ["NSE", "NYSE"],
          description: "Default NSE for Indian stocks",
        },
        limit: {
          type:        "number",
          description: "Max matches to return (default 5)",
        },
      },
    },
  },
  {
    name:        "find_stock_holdings",
    description: "Search stock holdings by symbol or company keyword. REQUIRED: pass symbol OR keyword — never call with empty args. Call ONCE before update_stock_holding; if it returns exactly 1 row, go straight to update_stock_holding — do not call find again.",
    parameters: {
      type:       "object",
      properties: {
        portfolio: {
          type:        "string",
          enum:        ["mine", "mother", "both"],
          description: "Default both",
        },
        symbol: {
          type:        "string",
          description: "Exact stored symbol (case-insensitive) e.g. SIEMENS",
        },
        keyword: {
          type:        "string",
          description: "Partial symbol or display name e.g. siemens, bharat",
        },
        exchange: {
          type:        "string",
          enum:        ["NSE", "NYSE"],
          description: "Optional — omit to search both exchanges; use NSE or NYSE (case-insensitive)",
        },
      },
    },
  },
  {
    name:        "update_stock_holding",
    description: "Patch an EXISTING stock (avg price, qty, symbol). Use symbol OR keyword to identify the row. Defaults: exchange NSE, portfolio mine. Pass ONLY fields being changed. After find_stock_holdings returns 1 match, call this immediately — never call find_stock_holdings again in the same task.",
    parameters: {
      type:       "object",
      properties: {
        symbol: {
          type:        "string",
          description: "Exact symbol from find_stock_holdings e.g. SIEMENS",
        },
        keyword: {
          type:        "string",
          description: "Company name e.g. Siemens — use when symbol uncertain",
        },
        exchange: {
          type:        "string",
          enum:        ["NSE", "NYSE"],
          description: "Default NSE for Indian stocks",
        },
        portfolio: {
          type:        "string",
          enum:        ["mine", "mother"],
          description: "Default mine unless user said mother/mom",
        },
        new_symbol: {
          type:        "string",
          description: "Correct NSE/NYSE ticker (only when fixing symbol)",
        },
        avg_price:  { type: "string", description: "New average buy price (numeric value)" },
        qty:        { type: "string", description: "New share quantity (numeric value)" },
        display_name: { type: "string", description: "Company name (only if changing)" },
        action:       { type: "string", description: "Note e.g. HOLD (only if changing)" },
      },
    },
  },
  {
    name:        "bulk_add_stocks",
    description: "Import many stock holdings from Excel/CSV in ONE call. Always use this for spreadsheet stock sync — never call add_or_update_stock once per row.",
    parameters: {
      type:       "object",
      properties: {
        portfolio: {
          type:        "string",
          enum:        ["mine", "mother"],
          description: "Target portfolio",
        },
        holdings: {
          type:        "array",
          description: "Stock rows from spreadsheet",
          items: {
            type:       "object",
            properties: {
              symbol:       { type: "string", description: "Ticker e.g. RELIANCE, ADANIGREEN" },
              display_name: { type: "string", description: "Company name from spreadsheet" },
              exchange:     { type: "string", enum: ["NSE", "NYSE"], description: "Default NSE for Indian stocks" },
              qty:          { type: "number", description: "Share quantity" },
              avg_price:    { type: "number", description: "Average buy price in local currency" },
              action:       { type: "string", description: "Optional note e.g. HOLD" },
            },
            required: ["symbol", "qty", "avg_price"],
          },
        },
      },
      required: ["portfolio", "holdings"],
    },
  },
  {
    name:        "add_or_update_stock",
    description: "CREATE a new stock holding ONLY — fails if symbol already exists. For avg price / qty changes on existing stocks use update_stock_holding. Call find_stock_holdings first to avoid duplicates.",
    parameters: {
      type:       "object",
      properties: {
        symbol:       { type: "string", description: "Stock ticker e.g. RELIANCE, NVDA" },
        display_name: { type: "string", description: "Human-friendly company name" },
        exchange:     { type: "string", enum: ["NSE", "NYSE"], description: "Stock exchange" },
        qty:          { type: "number", description: "Number of shares / fractional shares" },
        avg_price:    { type: "number", description: "Average buy price in local currency" },
        action:       { type: "string", description: "Investment note e.g. HOLD, BUY MORE, EXIT" },
        portfolio:    { type: "string", enum: ["mine", "mother"] },
      },
      required: ["symbol", "exchange", "qty", "avg_price", "portfolio"],
    },
  },
  {
    name:        "find_fixed_income_holdings",
    description: "Search fixed income holdings (PPF, EPF, NPS, FD, liquid, etc.) by type or label keyword. Call BEFORE delete_fixed_income or update_fixed_income. Never call with empty args.",
    parameters: {
      type:       "object",
      properties: {
        portfolio: {
          type:        "string",
          enum:        ["mine", "mother", "both"],
          description: "Default both",
        },
        type: {
          type:        "string",
          description: "Exact type: ppf, epf, nps, fd, bond, liquid, sweep_fd",
        },
        label: {
          type:        "string",
          description: "Label search e.g. Liquid / Arbitrage",
        },
        keyword: {
          type:        "string",
          description: "Partial match on label, type, or issuer",
        },
      },
    },
  },
  {
    name:        "update_fixed_income",
    description: "Patch an EXISTING fixed income holding (principal, rate, label). Call find_fixed_income_holdings first. Pass ONLY fields being changed.",
    parameters: {
      type:       "object",
      properties: {
        portfolio: { type: "string", enum: ["mine", "mother"], description: "Default mine" },
        type:      { type: "string", description: "Holding type e.g. liquid, ppf" },
        label:     { type: "string", description: "Exact or partial label from find result" },
        keyword:   { type: "string", description: "Search label/type if label unknown" },
        principal: { type: "string", description: "New principal amount (numeric value)" },
        rate:      { type: "string", description: "New rate % p.a. (numeric value)" },
        new_label: { type: "string", description: "Rename holding" },
        issuer:    { type: "string" },
        notes:     { type: "string" },
      },
    },
  },
  {
    name:        "delete_fixed_income",
    description: "Remove a fixed income holding (e.g. duplicate liquid counted in MF). First call WITHOUT confirmed to preview; call again with confirmed:\"true\" after user confirms. Use FLAT JSON string fields only — e.g. {\"type\":\"liquid\",\"label\":\"Liquid / Arbitrage\",\"portfolio\":\"mine\",\"confirmed\":\"true\"}",
    parameters: {
      type:       "object",
      properties: {
        portfolio: { type: "string", enum: ["mine", "mother"], description: "Default mine" },
        type:      { type: "string", description: "Type e.g. liquid" },
        label:     { type: "string", description: "Label e.g. Liquid / Arbitrage" },
        keyword:   { type: "string", description: "Search if type/label uncertain" },
        confirmed: {
          type:        "boolean",
          description: "Must be true only after user explicitly confirms",
        },
      },
    },
  },
  {
    name:        "delete_stock",
    description: "Delete a single stock. First call WITHOUT confirmed:true to show holding details; call again with confirmed:true only after explicit user approval.",
    parameters: {
      type:       "object",
      properties: {
        symbol:    { type: "string" },
        exchange:  { type: "string", enum: ["NSE", "NYSE"] },
        portfolio: { type: "string", enum: ["mine", "mother"] },
        confirmed: {
          type:        "boolean",
          description: "Must be true only after user explicitly confirms",
        },
      },
      required: ["symbol", "exchange", "portfolio"],
    },
  },
  {
    name:        "delete_all_stocks",
    description: "Delete ALL stocks in a portfolio. First call WITHOUT confirmed:true to preview; call again with confirmed:true only after explicit user approval.",
    parameters: {
      type:       "object",
      properties: {
        portfolio: {
          type:        "string",
          enum:        ["mine", "mother", "both"],
          description: "Which portfolio(s) to clear",
        },
        confirmed: {
          type:        "boolean",
          description: "Must be true only after user explicitly confirms",
        },
      },
      required: ["portfolio"],
    },
  },
  {
    name:        "add_action_item",
    description: "Add a new action item / todo.",
    parameters: {
      type:       "object",
      properties: {
        title:       { type: "string", description: "Short title" },
        description: { type: "string", description: "Optional detail" },
        priority:    { type: "string", enum: ["high", "medium", "low"] },
      },
      required: ["title"],
    },
  },
  {
    name:        "complete_action_item",
    description: "Mark an action item as completed.",
    parameters: {
      type:       "object",
      properties: {
        title_keyword: {
          type:        "string",
          description: "A keyword from the action item title to find it",
        },
      },
      required: ["title_keyword"],
    },
  },
  {
    name:        "log_snapshot",
    description: "Calculate and log the current portfolio value as a monthly snapshot.",
    parameters: {
      type:       "object",
      properties: {
        portfolio: { type: "string", enum: ["mine", "mother"] },
      },
      required: ["portfolio"],
    },
  },
  {
    name:        "update_investment_fund_value",
    description: "Update the current fund value for a ULIP or endowment insurance policy.",
    parameters: {
      type:       "object",
      properties: {
        policy_keyword: {
          type:        "string",
          description: "Keyword to identify the policy (e.g. 'ProGrowth', 'Jeevan Anand')",
        },
        new_value: {
          type:        "number",
          description: "Current fund value in ₹",
        },
        portfolio: { type: "string", enum: ["mine", "mother"] },
      },
      required: ["policy_keyword", "new_value", "portfolio"],
    },
  },
] as AgentToolDefinition[];

export const WRITE_TOOLS = new Set([
  "update_mf_units",
  "update_mf_holding",
  "add_mf_holding",
  "bulk_add_mf_holdings",
  "bulk_add_stocks",
  "update_stock_holding",
  "delete_mf_holding",
  "delete_all_mf_holdings",
  "add_or_update_stock",
  "delete_stock",
  "delete_all_stocks",
  "find_fixed_income_holdings",
  "update_fixed_income",
  "delete_fixed_income",
  "add_action_item",
  "complete_action_item",
  "log_snapshot",
  "update_investment_fund_value",
]);
