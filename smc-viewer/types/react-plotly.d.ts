declare module "react-plotly.js/factory" {
  const createPlotlyComponent: (plotly: unknown) => import("react").ComponentType<unknown>;
  export default createPlotlyComponent;
}

declare module "plotly.js-dist-min" {
  const Plotly: unknown;
  export default Plotly;
}
