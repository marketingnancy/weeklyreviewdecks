/* Themed Chart.js helpers (dark demographic panels). */
window.LEMCharts = {
  bar(canvas, labels, values, opts) {
    if (typeof Chart === "undefined") return null;   // tolerate Chart.js being unavailable
    opts = opts || {};
    return new Chart(canvas.getContext("2d"), {
      type: "bar",
      data: { labels: labels, datasets: [{
        data: values,
        backgroundColor: opts.colors || "#d6457a",
        borderRadius: 5, maxBarThickness: opts.maxBar || 70,
      }]},
      options: {
        responsive: true, maintainAspectRatio: false, animation: { duration: 500 },
        plugins: { legend: { display: false }, tooltip: { enabled: true } },
        scales: {
          x: { ticks: { color: "#cfc7e6", font: { size: 12 } }, grid: { display: false }, border: { display: false } },
          y: { beginAtZero: true, max: opts.max,
               ticks: { color: "#8b84a6", font: { size: 11 }, callback: v => opts.pct ? v + "%" : v },
               grid: { color: "rgba(255,255,255,.07)" }, border: { display: false } },
        },
      },
    });
  },
};
