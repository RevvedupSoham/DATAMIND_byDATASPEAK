import type { QueryResult } from "@/types/query";
import type { VisualizationConfig, ChartType } from "@/types/visualization";

const SUPPORTED_TYPES: ChartType[] = ["bar", "line", "pie"];
const MEASURE_HINT = /(count|total|sum|amount|salary|avg|average|mean|revenue|cost|price|percent|percentage|allocation|number|qty|quantity|hires?|employees?|people)/i;
const ID_HINT = /(^id$|_id$|^.*id$)/i;
const USEFUL_GROUP_ID = /(^dept_id$|^department_id$|^role_id$|^status_id$|^category_id$|^team_id$)/i;
const CATEGORY_HINT = /(department|dept|name|city|state|location|role|status|type|category|team|manager|username)/i;
const TIME_HINT = /(date|time|month|year|day|week|quarter|created|hired|hire)/i;

function isNumericValue(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "string" || value.trim() === "") return false;
  const n = Number(value);
  return Number.isFinite(n);
}

function isNumericColumn(result: QueryResult, column: string) {
  if (result.columnTypes[column] === "number") return true;
  const values = result.rows
    .map((row) => row[column])
    .filter((value) => value !== null && value !== undefined && value !== "");
  return values.length > 0 && values.every(isNumericValue);
}

function isDateColumn(result: QueryResult, column: string) {
  if (result.columnTypes[column] === "date") return true;
  if (TIME_HINT.test(column)) {
    const values = result.rows
      .map((row) => row[column])
      .filter((value) => value !== null && value !== undefined)
      .slice(0, 8);
    return values.length > 0 && values.every((value) => !Number.isNaN(Date.parse(String(value))));
  }
  return false;
}

function distinctCount(result: QueryResult, column: string) {
  return new Set(result.rows.map((row) => String(row[column] ?? "—"))).size;
}

function titleize(question: string): string {
  const trimmed = question.trim().replace(/[.?!]+$/, "");
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function chooseMeasure(result: QueryResult) {
  const numeric = result.columns.filter((column) => isNumericColumn(result, column) && !isDateColumn(result, column));
  if (numeric.length === 0) return null;

  return (
    numeric.find((column) => MEASURE_HINT.test(column) && !ID_HINT.test(column)) ??
    numeric.find((column) => !ID_HINT.test(column)) ??
    null
  );
}

function chooseCategory(result: QueryResult, exclude?: string | null) {
  const candidates = result.columns.filter((column) => {
    if (column === exclude || isDateColumn(result, column)) return false;
    const distinct = distinctCount(result, column);
    return distinct >= 2 && distinct <= 25;
  });

  return (
    candidates.find((column) => USEFUL_GROUP_ID.test(column)) ??
    candidates.find((column) => CATEGORY_HINT.test(column) && !ID_HINT.test(column) && distinctCount(result, column) < result.rowCount) ??
    candidates.find((column) => result.columnTypes[column] === "string" && !ID_HINT.test(column) && distinctCount(result, column) < result.rowCount) ??
    candidates.find((column) => CATEGORY_HINT.test(column) && !ID_HINT.test(column)) ??
    candidates.find((column) => result.columnTypes[column] === "string" && !ID_HINT.test(column)) ??
    null
  );
}

function requestedChart(question: string): ChartType | null {
  if (/\bpie\b|\bshare\b|\bproportion\b|\bdistribution\b/i.test(question)) return "pie";
  if (/\bline\b|\btrend\b|\bover time\b|\bplot\b|\bhistory\b|\bgrowth\b/i.test(question)) return "line";
  if (/\bbar\b|\bcompare\b|\bcomparison\b|\bby department\b|\beach department\b/i.test(question)) return "bar";
  return null;
}

/**
 * Builds every visualization that can be truthfully derived from the actual
 * query rows. It supports both already-aggregated results (e.g. department +
 * employee_count) and raw result sets (e.g. a list of employees), where a
 * count-by-category chart can be derived without inventing values.
 */
export function getVisualizationOptions(result: QueryResult, question: string): VisualizationConfig[] {
  if (result.rowCount < 2 || result.columns.length < 1) return [];

  const title = titleize(question);
  const explicit = requestedChart(question);
  const measure = chooseMeasure(result);
  const dateField = result.columns.find((column) => isDateColumn(result, column)) ?? null;
  const category = chooseCategory(result, measure);
  const configs: VisualizationConfig[] = [];

  // Already-aggregated data: category/date + numeric measure.
  if (measure) {
    const categoricalX = chooseCategory(result, measure);
    if (categoricalX) {
      const categories = distinctCount(result, categoricalX);
      configs.push({
        shouldVisualize: true,
        chartType: "bar",
        xField: categoricalX,
        yField: measure,
        title,
        aggregation: "none",
      });
      if (categories <= 8) {
        configs.push({
          shouldVisualize: true,
          chartType: "pie",
          xField: categoricalX,
          yField: measure,
          title,
          aggregation: "none",
        });
      }
    }

    if (dateField && dateField !== measure) {
      configs.push({
        shouldVisualize: true,
        chartType: "line",
        xField: dateField,
        yField: measure,
        title,
        aggregation: "none",
      });
    }
  }

  // Raw rows: derive a truthful count-by-category chart. This is especially
  // useful for owner queries like "show employees" where the result itself
  // contains department/city/status columns but no explicit COUNT column.
  if (!measure && category) {
    const categories = distinctCount(result, category);
    configs.push({
      shouldVisualize: true,
      chartType: "bar",
      xField: category,
      yField: "__count",
      title,
      aggregation: "count",
    });
    if (categories <= 8) {
      configs.push({
        shouldVisualize: true,
        chartType: "pie",
        xField: category,
        yField: "__count",
        title,
        aggregation: "count",
      });
    }
  }

  // A raw temporal result can still show record frequency over time.
  if (!measure && dateField) {
    configs.push({
      shouldVisualize: true,
      chartType: "line",
      xField: dateField,
      yField: "__count",
      title,
      aggregation: "count",
    });
  }

  // De-duplicate chart types. Prefer the question's explicitly requested
  // chart first; otherwise keep bar/pie/line in the natural discovery order.
  const unique = configs.filter(
    (config, index, all) => all.findIndex((other) => other.chartType === config.chartType) === index
  );

  if (explicit) {
    unique.sort((a, b) => Number(b.chartType === explicit) - Number(a.chartType === explicit));
  }

  return unique;
}

/** Validates a config against an actual result before rendering, defensively. */
export function isVisualizationRenderable(config: VisualizationConfig, result: QueryResult): boolean {
  if (!config.shouldVisualize || !config.chartType || !config.xField || !config.yField) return false;
  if (!SUPPORTED_TYPES.includes(config.chartType)) return false;
  if (!result.columns.includes(config.xField)) return false;

  if (config.aggregation === "count") {
    return config.yField === "__count";
  }

  if (!result.columns.includes(config.yField)) return false;
  return isNumericColumn(result, config.yField);
}
