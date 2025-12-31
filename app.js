let db;
let SQL;
let sortColumn = "total_read_time";
let sortAsc = false;
let charts = {};

const fileInput = document.getElementById("fileInput");
const minMinutesInput = document.getElementById("minMinutes");
const minMinutesValue = document.getElementById("minMinutesValue");
const summaryDiv = document.getElementById("summary");
const booksTableBody = document.querySelector("#booksTable tbody");

function renderWithLayoutReady(fn) {
  requestAnimationFrame(() => requestAnimationFrame(fn));
}

// Load sql.js
initSqlJs({
  locateFile: f =>
    `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.2/${f}`
}).then(sql => {
  SQL = sql;
  console.log("sql.js ready");
});

// Events
fileInput.addEventListener("change", loadDatabase);

minMinutesInput.addEventListener("input", () => {
  minMinutesValue.textContent = `${minMinutesInput.value} min`;
  if (db) renderAll();
});

document.querySelectorAll("#booksTable th").forEach(th => {
  th.addEventListener("click", () => {
    const col = th.dataset.sort;
    if (sortColumn === col) sortAsc = !sortAsc;
    else {
      sortColumn = col;
      sortAsc = true;
    }
    renderBooks();
  });
});

async function loadDatabase(e) {
  const file = e.target.files[0];
  if (!file) return;
  const buffer = await file.arrayBuffer();
  db = new SQL.Database(new Uint8Array(buffer));
  renderAll();
}

function renderAll() {
  renderSummary();
  renderBooks();

  renderWithLayoutReady(renderBooksPie);
  renderWithLayoutReady(renderDailyChart);
  renderWithLayoutReady(renderCumulativeChart);
  renderWithLayoutReady(renderWeekdayChart);
}

function resetChart(id) {
  if (charts[id]) charts[id].destroy();
}

function renderSummary() {
  const res = db.exec(`SELECT SUM(total_read_time) FROM book`);
  const seconds = res[0]?.values[0][0] || 0;
  summaryDiv.innerHTML = `
    <p><strong>${(seconds / 3600).toFixed(1)}</strong> total hours read</p>
  `;
}

function renderBooks() {
  booksTableBody.innerHTML = "";
  const minSeconds = Number(minMinutesInput.value) * 60;
  const dir = sortAsc ? "ASC" : "DESC";

  const res = db.exec(`
    SELECT
      title,
      GROUP_CONCAT(authors) AS authors,
      SUM(total_read_time) AS total_read_time
    FROM book
    WHERE total_read_time >= ${minSeconds}
    GROUP BY title
    ORDER BY ${sortColumn} ${dir}
  `);

  res[0]?.values.forEach(([title, authors, time]) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${title}</td>
      <td>${authors || ""}</td>
      <td>${(time / 3600).toFixed(1)}</td>
    `;
    booksTableBody.appendChild(tr);
  });
}

function baseAnimation() {
  return { duration: 900, easing: "easeOutQuart" };
}

// PIE
function renderBooksPie() {
  resetChart("booksPie");
  const minSeconds = Number(minMinutesInput.value) * 60;

  const res = db.exec(`
    SELECT title, SUM(total_read_time)
    FROM book
    WHERE total_read_time >= ${minSeconds}
    GROUP BY title
    ORDER BY 2 DESC
  `);

  charts.booksPie = new Chart(document.getElementById("booksPie"), {
    type: "pie",
    data: {
      labels: res[0].values.map(r => r[0]),
      datasets: [{
        data: res[0].values.map(r => (r[1] / 3600).toFixed(2))
      }]
    },
    options: {
      animation: baseAnimation(),
      plugins: {
        legend: {
          position: "right",
          labels: { padding: 6, boxWidth: 12 }
        }
      }
    }
  });
}

// DAILY
function renderDailyChart() {
  resetChart("dailyChart");

  const res = db.exec(`
    SELECT date(start_time,'unixepoch'), SUM(duration)/3600
    FROM page_stat_data
    GROUP BY 1
    ORDER BY 1
  `);

  charts.dailyChart = new Chart(document.getElementById("dailyChart"), {
    type: "bar",
    data: {
      labels: res[0].values.map(r => r[0]),
      datasets: [{ label: "Hours", data: res[0].values.map(r => r[1]) }]
    },
    options: {
      animation: baseAnimation(),
      scales: {
        x: {
          ticks: {
            callback: function(v) {
              const label = this.getLabelForValue(v);
              return label.endsWith("-01") ? label : "";
            },
            autoSkip: false
          }
        }
      }
    }
  });
}

// CUMULATIVE
function renderCumulativeChart() {
  resetChart("cumulativeChart");

  const res = db.exec(`
    SELECT date(start_time,'unixepoch'), SUM(duration)/60
    FROM page_stat_data
    GROUP BY 1
    ORDER BY 1
  `);

  let total = 0;
  const data = res[0].values.map(r => (total += r[1]));

  charts.cumulativeChart = new Chart(document.getElementById("cumulativeChart"), {
    type: "line",
    data: {
      labels: res[0].values.map(r => r[0]),
      datasets: [{
        label: "Minutes",
        data,
        fill: true,
        tension: 0.3
      }]
    },
    options: { animation: baseAnimation() }
  });
}

// WEEKDAY
function renderWeekdayChart() {
  resetChart("weekdayChart");

  const res = db.exec(`
    SELECT strftime('%w', start_time,'unixepoch'), SUM(duration)/3600
    FROM page_stat_data
    GROUP BY 1
  `);

  const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const values = Array(7).fill(0);
  res[0].values.forEach(([d,h]) => values[d] = h);

  charts.weekdayChart = new Chart(document.getElementById("weekdayChart"), {
    type: "bar",
    data: {
      labels: days,
      datasets: [{ label: "Hours", data: values }]
    },
    options: { animation: baseAnimation() }
  });
}
