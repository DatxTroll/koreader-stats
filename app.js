// ===== GLOBAL STATE =====
let db = null;
let SQL = null;
let lastQueryResults = null;

// ===== DOM =====
const fileInput = document.getElementById("fileInput");
const summaryDiv = document.getElementById("summary");
const booksTableBody = document.querySelector("#booksTable tbody");

fileInput.disabled = true;
summaryDiv.innerHTML = "<p>Loading SQLite engine…</p>";

// ===== LOAD SQL.JS =====
initSqlJs({
  locateFile: file =>
    `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.2/${file}`
}).then(sql => {
  SQL = sql;
  fileInput.disabled = false;
  summaryDiv.innerHTML = "<p>SQLite engine loaded. Upload your stats file.</p>";
  console.log("sql.js ready");
});

// ======================================================
// 🔴 THIS IS THE DB LOAD SPOT 🔴
// ======================================================
fileInput.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  console.log("File selected:", file.name);
  const buffer = await file.arrayBuffer();
  db = new SQL.Database(new Uint8Array(buffer));
  console.log("Database opened");

  inspectSchema();

  // ---- RENDER EVERYTHING HERE ----
  renderSummary();
  renderBooks();
  renderBooksPie();
  renderDailyChart();
  renderCumulativeChart();
  renderWeekdayChart();
});

// ===== SCHEMA DEBUG =====
function inspectSchema() {
  const res = db.exec(`
    SELECT name FROM sqlite_master
    WHERE type='table'
  `);
  const tables = res[0]?.values.flat() || [];
  console.log("Tables found:", tables);
}

// ===== SUMMARY =====
function renderSummary() {
  const res = db.exec(`
    SELECT SUM(total_read_time)
    FROM book
  `);

  const seconds = res[0]?.values[0][0] || 0;

  summaryDiv.innerHTML = `
    <h2>Total Reading Time</h2>
    <p>${(seconds / 3600).toFixed(1)} hours</p>
  `;
}

// ===== BOOKS TABLE =====
function renderBooks() {
  booksTableBody.innerHTML = "";

  const res = db.exec(`
    SELECT title, authors, total_read_time
    FROM book
    ORDER BY total_read_time DESC
  `);

  lastQueryResults = res[0];

  res[0].values.forEach(row => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row[0]}</td>
      <td>${row[1] || ""}</td>
      <td>${(row[2] / 3600).toFixed(1)}</td>
    `;
    booksTableBody.appendChild(tr);
  });
}

// ===== PIE: TIME BY BOOK =====
function renderBooksPie() {
  const res = db.exec(`
    SELECT title, total_read_time
    FROM book
    WHERE total_read_time > 0
    ORDER BY total_read_time DESC
  `);

  if (!res.length) return;

  new Chart(document.getElementById("booksPie"), {
    type: "pie",
    data: {
      labels: res[0].values.map(r => r[0]),
      datasets: [{
        data: res[0].values.map(r => (r[1] / 3600).toFixed(2))
      }]
    }
  });
}

// ===== DAILY BAR =====
function renderDailyChart() {
  const res = db.exec(`
    SELECT
      date(start_time, 'unixepoch') AS day,
      SUM(duration) / 3600.0 AS hours
    FROM page_stat_data
    GROUP BY day
    ORDER BY day
  `);

  if (!res.length) return;

  new Chart(document.getElementById("dailyChart"), {
    type: "bar",
    data: {
      labels: res[0].values.map(r => r[0]),
      datasets: [{
        label: "Hours Read",
        data: res[0].values.map(r => r[1])
      }]
    }
  });
}

// ===== CUMULATIVE MINUTES =====
function renderCumulativeChart() {
  const res = db.exec(`
    SELECT
      date(start_time, 'unixepoch') AS day,
      SUM(duration) / 60.0 AS minutes
    FROM page_stat_data
    GROUP BY day
    ORDER BY day
  `);

  if (!res.length) return;

  let total = 0;
  const labels = [];
  const data = [];

  res[0].values.forEach(([day, minutes]) => {
    total += minutes;
    labels.push(day);
    data.push(total);
  });

  new Chart(document.getElementById("cumulativeChart"), {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "Cumulative Minutes Read",
        data,
        fill: true,
        tension: 0.3
      }]
    }
  });
}

// ===== WEEKDAY BAR =====
function renderWeekdayChart() {
  const res = db.exec(`
    SELECT
      strftime('%w', start_time, 'unixepoch') AS weekday,
      SUM(duration) / 3600.0 AS hours
    FROM page_stat_data
    GROUP BY weekday
  `);

  if (!res.length) return;

  const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const hours = Array(7).fill(0);

  res[0].values.forEach(([d, h]) => {
    hours[Number(d)] = h;
  });

  new Chart(document.getElementById("weekdayChart"), {
    type: "bar",
    data: {
      labels: names,
      datasets: [{
        label: "Hours Read",
        data: hours
      }]
    }
  });
}

