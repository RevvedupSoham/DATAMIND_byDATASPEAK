export type ChartType = "bar" | "line" | "pie";
export type VisualizationAggregation = "none" | "count";

export interface VisualizationConfig {
  shouldVisualize: boolean;
  chartType: ChartType | null;
  xField: string | null;
  yField: string | null;
  title: string | null;
  /**
   * `count` means the chart should group rows by xField and plot the number
   * of rows in each group. This lets DataMind visualize raw result sets such
   * as employee lists without inventing any data.
   */
  aggregation?: VisualizationAggregation;
}
