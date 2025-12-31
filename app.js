// ================== GLOBAL STATE ==================
let db = null;
let SQL = null;

let charts = {};
let sortColumn = "total_read_time";
let sortAsc = false;

// ================== DOM ==================
const fileInput = document.getElementById("fileInput");
const summaryDiv = document.getElementById("summary");
const booksTableBody = document.querySelector("#booksTable tbody");
const minMinutesInput = document.getElementById("minMinutes");
const minMinutesLabel = document.getElementById("minMinutesLabel");

// ================== SORTING ==================
document.querySelectorAll("#booksTable th").forEach(th => {
  th.addEventListener("click", () => {
    const col = th.dataset.sort;
    if (sortColumn === col) {
      sortAsc = !sortAsc;
    } else {
      sortColumn = col;
      sortAsc = true;
    }
    renderAll();
  });
});

// ================== MINUTES FILTER ==================
minMinutesInput.addEventListener("input", () => {
  minMinutesLabel.textContent = `${minMinutesInput.value} min`;
  if (db) renderAll();
});

// ================== LOAD SQL.JS ==================
fileInput.disabled = true;
summaryDiv.innerHTML = "<p>Loading SQLite engine…</p>";

initSqlJs({
  locateFile: file =>
    `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.2/${file}`
}).then(sql => {
  SQL = sql;
  fileInput.disabled = false;
  summaryDiv.innerHTML = "<p>Upload your KOReader statistics file.</p>";
});

// ================== DB LOAD ==================
fileInput.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const buffer = await file.arrayBuffer();
  db = new SQL.Database(new Uint8Array(buffer));

  renderAll();
});

// ================== RENDER ALL ==================
function renderAll() {
  renderSummary();
  renderBooks();
  renderBooksPie();
  renderDailyChart();
  renderCumulativeChart();
  renderWeekdayChart();
}

// ================== SUMMARY ==================
function renderSummary() {
  const res = db.exec(`SELECT SUM(total_read_time) FROM book`);
  const seconds = res[0]?.values[0][0] || 0;

  summaryDiv.innerHTML = `
    <h2>Total Reading Time</h2>
    <p>${(seconds / 3600).toFixed(1)} hours</p>
  `;
}

// ================== BOOK TABLE ==================
function renderBooks() {
  booksTableBody.innerHTML = "";

  const minSeconds = minMinutesInput.value * 60;
  const dir = sortAsc ? "ASC" : "DESC";

  const res = db.exec(
    `
    SELECT
      title,
      GROUP_CONCAT(authors) AS authors,
      SUM(total_read_time) AS total_read_time
    FROM book
    WHERE total_read_time >= ?
    GROUP BY title
    ORDER BY ${sortColumn} ${dir}
    `,
    [minSeconds]
  );

  res[0]?.values.forEach(row => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row[0]}</td>
      <td>${row[1] || ""}</td>
      <td>${(row[2] / 3600).toFixed(2)}</td>
    `;
    booksTableBody.appendChild(tr);
  });
}

// ================== CHART HELPERS ==================
function resetChart(id) {
  if (charts[id]) {
    charts[id].destroy();
    delete charts[id];
  }
}

// ================== PIE ==================
function renderBooksPie() {
  resetChart("booksPie");

  const minSeconds = minMinutesInput.value * 60;
  const res = db.exec(
    `
    SELECT title, SUM(total_read_time)
    FROM book
    WHERE total_read_time >= ?
    GROUP BY title
    ORDER BY SUM(total_read_time) DESC
    `,
    [minSeconds]
  );

  charts.booksPie = new Chart(
    document.getElementById("booksPie"),
    {
      type: "pie",
      data: {
        labels: res[0]?.values.map(r => r[0]) || [],
        datasets: [{
          data: res[0]?.values.map(r => (r[1] / 3600)) || []
        }]
      }
    }
  );
}

// ================== DAILY ==================
function renderDailyChart() {
  resetChart("dailyChart");

  const res = db.exec(`
    SELECT date(start_time,'unixepoch'), SUM(duration)/3600
    FROM page_stat_data
    GROUP BY 1
    ORDER BY 1
  `);

  charts.dailyChart = new Chart(
    document.getElementById("dailyChart"),
    {
      type: "bar",
      data: {
        labels: res[0]?.values.map(r => r[0]) || [],
        datasets: [{
          label: "Hours",
          data: res[0]?.values.map(r => r[1]) || []
        }]
      }
    }
  );
}

// ================== CUMULATIVE ==================
function renderCumulativeChart() {
  resetChart("cumulativeChart");

  const res = db.exec(`
    SELECT date(start_time,'unixepoch'), SUM(duration)/60
    FROM page_stat_data
    GROUP BY 1
    ORDER BY 1
  `);

  let total = 0;
  const labels = [];
  const data = [];

  res[0]?.values.forEach(([d, m]) => {
    total += m;
    labels.push(d);
    data.push(total);
  });

  charts.cumulativeChart = new Chart(
    document.getElementById("cumulativeChart"),
    {
      type: "line",
      data: {
        labels,
        datasets: [{
          label: "Minutes",
          data,
          fill: true,
          tension: 0.3
        }]
      }
    }
  );
}

// ================== WEEKDAY ==================
function renderWeekdayChart() {
  resetChart("weekdayChart");

  const res = db.exec(`
    SELECT strftime('%w',start_time,'unixepoch'), SUM(duration)/3600
    FROM page_stat_data
    GROUP BY 1
  `);

  const names = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const hours = Array(7).fill(0);

  res[0]?.values.forEach(([d,h]) => hours[Number(d)] = h);

  charts.weekdayChart = new Chart(
    document.getElementById("weekdayChart"),
    {
      type: "bar",
      data: {
        labels: names,
        datasets: [{
          label: "Hours",
          data: hours
        }]
      }
    }
  );
}
