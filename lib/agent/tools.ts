import type { FunctionDeclaration } from "@google/generative-ai";
import { MF_CATEGORY_HINT } from "@/lib/utils/mf-category";

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
    description: "Get a summary of a portfolio including total value, MF value, stock value, and monthly SIP amount. Use this to answer questions about portfolio performance.",
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
    description: "Delete a single mutual fund holding by scheme code. For deleting ALL MF holdings at once, use delete_all_mf_holdings instead. Only call after explicit user confirmation.",
    parameters: {
      type:       "object",
      properties: {
        scheme_code: { type: "string" },
        portfolio:   { type: "string", enum: ["mine", "mother"] },
      },
      required: ["scheme_code", "portfolio"],
    },
  },
  {
    name:        "delete_all_mf_holdings",
    description: "Delete ALL mutual fund holdings in one portfolio (or both). Use when user asks to remove/clear all MF holdings. Only call after explicit confirmation — list what will be deleted first unless user already said delete all/clear all.",
    parameters: {
      type:       "object",
      properties: {
        portfolio: {
          type:        "string",
          enum:        ["mine", "mother", "both"],
          description: "Which portfolio(s) to clear",
        },
      },
      required: ["portfolio"],
    },
  },
  {
    name:        "add_or_update_stock",
    description: "Add a new stock holding or update quantity/price for an existing one.",
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
    name:        "delete_stock",
    description: "Delete a single stock holding. For deleting ALL stocks at once, use delete_all_stocks instead. Only call after explicit confirmation from the user.",
    parameters: {
      type:       "object",
      properties: {
        symbol:    { type: "string" },
        exchange:  { type: "string", enum: ["NSE", "NYSE"] },
        portfolio: { type: "string", enum: ["mine", "mother"] },
      },
      required: ["symbol", "exchange", "portfolio"],
    },
  },
  {
    name:        "delete_all_stocks",
    description: "Delete ALL stock holdings in one portfolio (or both). Use when user asks to remove/clear all stocks. Only call after explicit confirmation.",
    parameters: {
      type:       "object",
      properties: {
        portfolio: {
          type:        "string",
          enum:        ["mine", "mother", "both"],
          description: "Which portfolio(s) to clear",
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
] as FunctionDeclaration[];

export const WRITE_TOOLS = new Set([
  "update_mf_units",
  "update_mf_holding",
  "add_mf_holding",
  "bulk_add_mf_holdings",
  "delete_mf_holding",
  "delete_all_mf_holdings",
  "add_or_update_stock",
  "delete_stock",
  "delete_all_stocks",
  "add_action_item",
  "complete_action_item",
  "log_snapshot",
  "update_investment_fund_value",
]);
