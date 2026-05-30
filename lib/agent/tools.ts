import type { FunctionDeclaration } from "@google/generative-ai";

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
    name:        "update_mf_units",
    description: "Update the unit count for a mutual fund holding. Use this after a SIP deduction or lump sum purchase to record the new unit balance.",
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
          description: "Which portfolio this holding belongs to",
        },
      },
      required: ["scheme_code", "new_units", "portfolio"],
    },
  },
  {
    name:        "add_mf_holding",
    description: "Add a new mutual fund holding to a portfolio.",
    parameters: {
      type:       "object",
      properties: {
        scheme_code: { type: "string", description: "AMFI scheme code" },
        scheme_name: { type: "string", description: "Full scheme name" },
        units:       { type: "number", description: "Number of units" },
        avg_nav:     { type: "number", description: "Average NAV / purchase price" },
        sip_amount:  { type: "number", description: "Monthly SIP amount (0 if lump sum)" },
        sip_date:    { type: "number", description: "SIP date: 7 or 28" },
        category:    { type: "string", description: "Flexi | Mid | Small | Large | Index | Gold | Hybrid | BAF" },
        portfolio:   { type: "string", enum: ["mine", "mother"] },
      },
      required: ["scheme_code", "scheme_name", "units", "portfolio"],
    },
  },
  {
    name:        "delete_mf_holding",
    description: "Delete a mutual fund holding. IMPORTANT: Only use this after explicit user confirmation. Mention what you are deleting and ask user to confirm before calling this.",
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
    description: "Delete a stock holding. Only call after explicit confirmation from the user.",
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
  "add_mf_holding",
  "delete_mf_holding",
  "add_or_update_stock",
  "delete_stock",
  "add_action_item",
  "complete_action_item",
  "log_snapshot",
  "update_investment_fund_value",
]);
