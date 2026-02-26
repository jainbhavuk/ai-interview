const METRIC_THRESHOLDS = {
  lcp: { good: 2500, poor: 4000, unit: "ms" },
  cls: { good: 0.1, poor: 0.25, unit: "" },
  inp: { good: 200, poor: 500, unit: "ms" },
  fcp: { good: 1800, poor: 3000, unit: "ms" },
  ttfb: { good: 800, poor: 1800, unit: "ms" },
};

function classifyMetric(metricName, value) {
  const thresholds = METRIC_THRESHOLDS[metricName];
  if (!thresholds) {
    return "unknown";
  }

  if (value <= thresholds.good) {
    return "good";
  }

  if (value > thresholds.poor) {
    return "poor";
  }

  return "needs-improvement";
}

function reportMetric(name, value) {
  const status = classifyMetric(name, value);
  const unit = METRIC_THRESHOLDS[name]?.unit || "";
  const rounded = Number(value.toFixed(2));
  const suffix = unit ? ` ${unit}` : "";

  if (status === "poor") {
    console.warn(
      `[WebVitals] ${name.toUpperCase()}: ${rounded}${suffix} (${status})`,
    );
    return;
  }

  console.info(
    `[WebVitals] ${name.toUpperCase()}: ${rounded}${suffix} (${status})`,
  );
}

function observeLCP() {
  if (!("PerformanceObserver" in window)) {
    return;
  }

  const observer = new PerformanceObserver((entryList) => {
    const entries = entryList.getEntries();
    const lastEntry = entries[entries.length - 1];
    if (lastEntry) {
      reportMetric("lcp", lastEntry.startTime);
    }
  });

  observer.observe({ type: "largest-contentful-paint", buffered: true });
}

function observeCLS() {
  if (!("PerformanceObserver" in window)) {
    return;
  }

  let clsValue = 0;
  const observer = new PerformanceObserver((entryList) => {
    entryList.getEntries().forEach((entry) => {
      if (!entry.hadRecentInput) {
        clsValue += entry.value;
      }
    });
    reportMetric("cls", clsValue);
  });

  observer.observe({ type: "layout-shift", buffered: true });
}

function observeINP() {
  if (!("PerformanceObserver" in window)) {
    return;
  }

  const observer = new PerformanceObserver((entryList) => {
    const entries = entryList.getEntries();
    const lastEntry = entries[entries.length - 1];
    if (!lastEntry?.duration) {
      return;
    }
    reportMetric("inp", lastEntry.duration);
  });

  try {
    observer.observe({ type: "event", durationThreshold: 40, buffered: true });
  } catch {
    // Older browsers may not support event timing entries.
  }
}

function observeNavigation() {
  if (!("performance" in window)) {
    return;
  }

  const [navigation] = performance.getEntriesByType("navigation");
  if (!navigation) {
    return;
  }

  reportMetric("ttfb", navigation.responseStart);
}

function observeFCP() {
  if (!("PerformanceObserver" in window)) {
    return;
  }

  const observer = new PerformanceObserver((entryList) => {
    const entries = entryList.getEntries();
    entries.forEach((entry) => {
      if (entry.name === "first-contentful-paint") {
        reportMetric("fcp", entry.startTime);
      }
    });
  });

  observer.observe({ type: "paint", buffered: true });
}

/**
 * Initializes lightweight Web Vitals observers in development.
 */
export function startWebVitalsObserver() {
  if (typeof window === "undefined") {
    return;
  }

  observeLCP();
  observeCLS();
  observeINP();
  observeFCP();
  observeNavigation();
}
