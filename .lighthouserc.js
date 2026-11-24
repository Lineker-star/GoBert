// Lighthouse CI config — mobile performance >= 85.
// Run: npx @lhci/cli autorun  (requires the dev server on :3000)
module.exports = {
  ci: {
    collect: {
      url: ["http://localhost:3000/fr"],
      numberOfRuns: 3,
      settings: {
        preset: "mobile",
        onlyCategories: ["performance"],
      },
    },
    assert: {
      assertions: {
        "categories:performance": [">= 0.85", { aggregationMethod: "median" }],
      },
    },
    upload: {
      target: "temporary-public-storage",
    },
  },
};