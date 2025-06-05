export { options } from "./scripts/station-load-test.js";

export const options = {
  ...options,

  ext: {
    loadimpact: {
      distribution: {
        "amazon:us:ashburn": { loadZone: "amazon:us:ashburn", percent: 100 },
      },
    },
  },

  summaryTrendStats: [
    "avg",
    "min",
    "med",
    "max",
    "p(90)",
    "p(95)",
    "p(99)",
    "p(99.9)",
    "count",
  ],

  noConnectionReuse: false,

  discardResponseBodies: false,

  metricSamplesBufferSize: 10000,
};

export default function () {
  console.log("k6 configuration loaded");
}
