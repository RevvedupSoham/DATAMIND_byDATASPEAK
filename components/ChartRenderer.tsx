"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { QueryResult } from "@/types/query";
import type { VisualizationConfig } from "@/types/visualization";

const PIE_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
  "var(--chart-7)",
  "var(--chart-8)",
];

function prettyLabel(value: string) {
  if (value === "__count") return "Count";
  return value.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function rawChartData(result: QueryResult, xField: string, yField: string) {
  return result.rows.map((row) => ({
    [xField]: row[xField] === null || row[xField] === undefined ? "—" : String(row[xField]),
    [yField]: typeof row[yField] === "number" ? row[yField] : Number(row[yField]) || 0,
  }));
}

function countedChartData(result: QueryResult, xField: string) {
  const groups = new Map<string, number>();
  for (const row of result.rows) {
    const label = row[xField] === null || row[xField] === undefined ? "—" : String(row[xField]);
    groups.set(label, (groups.get(label) ?? 0) + 1);
  }
  return Array.from(groups.entries()).map(([label, count]) => ({ [xField]: label, __count: count }));
}

const tooltipStyle = {
  background: "var(--chart-tooltip-bg)",
  border: "1px solid var(--chart-tooltip-border)",
  borderRadius: 2,
  color: "var(--chart-tooltip-text)",
  fontSize: 12,
};

export function ChartRenderer({ config, result }: { config: VisualizationConfig; result: QueryResult }) {
  if (!config.shouldVisualize || !config.chartType || !config.xField || !config.yField) return null;

  const xField = config.xField;
  const yField = config.yField;
  const data = config.aggregation === "count"
    ? countedChartData(result, xField)
    : rawChartData(result, xField, yField);

  const yLabel = prettyLabel(yField);
  const xLabel = prettyLabel(xField);

  return (
    <div className="rounded-sm border border-ink-800 bg-ink-950 p-5 sm:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="text-xs font-semibold uppercase tracking-widest2 text-ink-400">
            {config.title ?? "Visualization"}
          </span>
          <p className="mt-1 text-xs text-ink-600">
            {config.aggregation === "count" ? `${yLabel} grouped by ${xLabel}` : `${yLabel} by ${xLabel}`}
          </p>
        </div>
        <span className="rounded-full border border-accent-500/30 bg-accent-500/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest2 text-accent-400">
          {config.chartType} chart
        </span>
      </div>

      <div className="h-80 w-full sm:h-96">
        <ResponsiveContainer width="100%" height="100%">
          {config.chartType === "bar" ? (
            <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 18 }}>
              <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
              <XAxis
                dataKey={xField}
                stroke="var(--chart-axis)"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: "var(--chart-grid)" }}
                interval={0}
                angle={data.length > 7 ? -25 : 0}
                textAnchor={data.length > 7 ? "end" : "middle"}
                height={data.length > 7 ? 70 : 35}
              />
              <YAxis stroke="var(--chart-axis)" fontSize={11} tickLine={false} axisLine={{ stroke: "var(--chart-grid)" }} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgb(var(--accent-400) / 0.08)" }} />
              <Bar dataKey={yField} name={yLabel} fill="var(--chart-1)" radius={[2, 2, 0, 0]} />
            </BarChart>
          ) : config.chartType === "line" ? (
            <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 18 }}>
              <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
              <XAxis
                dataKey={xField}
                stroke="var(--chart-axis)"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: "var(--chart-grid)" }}
                minTickGap={24}
              />
              <YAxis stroke="var(--chart-axis)" fontSize={11} tickLine={false} axisLine={{ stroke: "var(--chart-grid)" }} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey={yField} name={yLabel} stroke="var(--chart-1)" strokeWidth={2.5} dot={{ r: 3, fill: "var(--chart-1)" }} activeDot={{ r: 5 }} />
            </LineChart>
          ) : (
            <PieChart>
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 11, color: "var(--chart-axis)" }} />
              <Pie
                data={data}
                dataKey={yField}
                nameKey={xField}
                cx="50%"
                cy="46%"
                outerRadius={118}
                innerRadius={48}
                paddingAngle={1}
                labelLine={false}
                label={({ name, percent }) => `${String(name)} ${Math.round((percent ?? 0) * 100)}%`}
              >
                {data.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
            </PieChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
