import { z } from "zod";
import { Tool } from "../types.js";
import type { StrategyAnalysis, ExtractStrategyResponse } from "../../client.js";

// OPTD Research Lens — docs/features/optd-research-lens.md (web repo)

const STATUS_BADGE: Record<string, string> = {
  stated: "STATED",
  implied: "IMPLIED",
  visual_only: "CHART ONLY",
};

function formatStrategy(title: string, a: StrategyAnalysis): string {
  let text = `# 📈 ${a.strategy_name || title}\n`;
  text += `**Testability:** ${a.testability.score}/100 — ${a.testability.verdict.replace(/_/g, " ")} (${a.testability.reason})\n\n`;

  if (!a.is_strategy) {
    text += `⚠️ This content discusses trading but states no concrete rule set.\n\n`;
  }

  text += `## Summary\n${a.summary}\n\n`;

  const m = a.market;
  text += `## Market (${m.stated_or_implied})\n`;
  text += `- Instruments: ${m.instruments.length ? m.instruments.join(", ") : "not stated"}\n`;
  text += `- Timeframes: ${m.timeframes.length ? m.timeframes.join(", ") : "not stated"}\n`;
  text += `- Session: ${m.session ?? "not stated"}\n\n`;

  if (a.rules.length > 0) {
    text += `## Rules\n`;
    a.rules.forEach((r) => {
      text += `- **${r.kind}** [${STATUS_BADGE[r.status] ?? r.status}${r.testable ? "" : ", not testable"}] ${r.rule}\n`;
      if (r.evidence) text += `  > "${r.evidence}"\n`;
      if (r.ambiguity) text += `  ❓ ${r.ambiguity}\n`;
    });
    text += `\n`;
  }

  if (a.indicators.length > 0) {
    text += `## Indicators\n`;
    a.indicators.forEach((i) => {
      text += `- ${i.name} — ${i.role}${i.settings ? ` (${i.settings})` : ""} [${i.stated_or_implied}]\n`;
    });
    text += `\n`;
  }

  if (a.unverifiable_claims.length > 0) {
    text += `## Unverifiable claims\n`;
    a.unverifiable_claims.forEach((c) => {
      text += `- "${c.claim}" — ${c.why}\n`;
    });
    text += `\n`;
  }

  if (a.missing_for_backtest.length > 0) {
    text += `## Missing before this can be backtested\n`;
    a.missing_for_backtest.forEach((item) => {
      text += `- ${item}\n`;
    });
    text += `\n`;
  }

  text += `## Backtest brief\n${a.claude_code_spec}\n`;
  return text;
}

function formatUsage(usage: ExtractStrategyResponse["usage"]): string {
  if (!usage || usage.monthlyAllowance === null) return "";
  const left = Math.max(usage.monthlyAllowance - usage.usedThisMonth, 0);
  return `\n---\nStrategy analyses left this month: ${left}/${usage.monthlyAllowance}${
    usage.topupRemaining > 0 ? ` (+${usage.topupRemaining} top-up)` : ""
  }\n`;
}

export const extractStrategyTool: Tool = {
  name: "extract_strategy",
  description: `Extract a trading strategy from ONE saved item as a backtest-ready brief (~1–3k tokens).

Returns the rules the creator gave, each marked STATED (said out loud), IMPLIED (inferred) or CHART ONLY (shown, never said), with a verbatim quote as evidence. Also returns indicators by role (levels / confluence / gate), performance claims that can't be verified, everything a backtest needs that the content doesn't answer, a 0–100 testability score, and a markdown brief (rules as pseudocode, labelled ASSUMPTIONs, open questions, what result would falsify it).

Use for: "what are the rules in this video", "can I backtest this", "turn this strategy into code". Find the item first with search_content. The result is cached and cached reads are free; a fresh run (first time or refresh=true) uses one analysis from the user's monthly allowance. Requires Noverload Pro or an OPTD membership.

When you build a backtest from it, carry every ASSUMPTION into the code as a named parameter and report results per assumption. Never present an IMPLIED or CHART ONLY rule as something the creator said.`,
  inputSchema: {
    type: "object",
    properties: {
      contentId: {
        type: "string",
        description: "ID of the saved content (from search_content or list_saved_content)",
      },
      refresh: {
        type: "boolean",
        default: false,
        description: "Re-run the analysis instead of returning the cached one",
      },
    },
    required: ["contentId"],
  },
  modifies: true,
  requiredFeature: "noverload.lens",

  handler: async (client, args) => {
    const schema = z.object({
      contentId: z.string(),
      refresh: z.boolean().optional().default(false),
    });
    const params = schema.parse(args);

    const result = await client.extractStrategy(params.contentId, params.refresh);

    return {
      content: [
        {
          type: "text",
          text:
            formatStrategy(result.contentTitle, result.analysis) +
            formatUsage(result.usage),
        },
      ],
      data: result,
    };
  },
};
