let db = null;
let SQL = null;

let sortColumn = "total_read_time";
let sortAsc = false;

let charts = {};

const fileInput = document.getElementById("fileInput");
const summaryDiv = document.getElementById("summary");
const booksTableBody = document.querySelector("#booksTable tbody");

const minMinutes = document.getElementById("minMinutes");
const minMinutesLabel = document.getElementById("minMinutesLabel");

minMinutes.addEventListener("input", () => {
  minMinutesLabel.textContent = minMinutes.value;
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

fileInput.disabled = true;
summaryDiv.textContent = "Loading SQLite engine…";

initSqlJs({
  locateFile: f =>
    `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.2/${f}`
}).then(sql => {
  SQL = sql;
  fileInput.disabled = false;
  summaryDiv.textContent = "Upload your statistics.sqlite3 file";
});

fileInput.addEventListener("change", async e => {
  const file = e.target.files[0];
  if (!file) return;

  const buffer = await file.arrayBuffer();
  db = new SQL.Database(new Uint8Array(buffer));
  renderAll();
});

function renderAll() {
  renderSummary();
  renderBooks();
  renderBooksPie();
  renderDaily();
  renderCumulative();
  renderWeekday();
}

function renderSummary() {
  const res = db.exec(`SELECT SUM(total_read_time) FROM book`);
  const sec = res[0]?.values[0][0] || 0;
  summaryDiv.innerHTML = `<strong>Total:</strong> ${(sec / 3600).toFixed(1)} hrs`;
}

function renderBooks() {
  booksTableBody.innerHTML = "";
  const minSec = minMinutes.value * 60;
  const dir = sortAsc ? "ASC" : "DESC";

  const res = db.exec(`
    SELECT
      title,
      GROUP_CONCAT(authors),
      SUM(total_read_time) AS total_read_time
    FROM book
    WHERE total_read_time >= ${minSec}
    GROUP BY title
    ORDER BY ${sortColumn} ${dir}
  `);

  if (!res.length) return;

  res[0].values.forEach(r => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r[0]}</td>
      <td>${r[1] || ""}</td>
      <td>${(r[2] / 3600).toFixed(2)}</td>
    `;
    booksTableBody.appendChild(tr);
  });
}

function resetChart(id) {
  if (charts[id]) charts[id].destroy();
}

function renderBooksPie() {
  resetChart("booksPie");

  const minSec = minMinutes.value * 60;
  const res = db.exec(`
    SELECT title, SUM(total_read_time)
    FROM book
    WHERE total_read_time >= ${minSec}
    GROUP BY title
    ORDER BY 2 DESC
    LIMIT 12
  `);

  if (!res.length) return;

  charts.booksPie = new Chart(
    document.getElementById("booksPie"),
    {
      type: "pie",
      data: {
        labels: res[0].values.map(v => v[0]),
        datasets: [{
          data: res[0].values.map(v => (v[1] / 3600).toFixed(2))
        }]
      }
    }
  );
}

function renderDaily() {
  resetChart("daily");

  const res = db.exec(`
    SELECT date(start_time,'unixepoch'), SUM(duration)/3600
    FROM page_stat_data
    GROUP BY 1
    ORDER BY 1
  `);

  if (!res.length) return;

  charts.daily = new Chart(
    document.getElementById("dailyChart"),
    {
      type: "bar",
      data: {
        labels: res[0].values.map(v => v[0]),
        datasets: [{ label: "Hours", data: res[0].values.map(v => v[1]) }]
      }
    }
  );
}

function renderCumulative() {
  resetChart("cumulative");

  const res = db.exec(`
    SELECT date(start_time,'unixepoch'), SUM(duration)/60
    FROM page_stat_data
    GROUP BY 1
    ORDER BY 1
  `);

  let total = 0;
  const labels = [];
  const data = [];

  res[0].values.forEach(v => {
    total += v[1];
    labels.push(v[0]);
    data.push(total);
  });

  charts.cumulative = new Chart(
    document.getElementById("cumulativeChart"),
    {
      type: "line",
      data: {
        labels,
        datasets: [{ label: "Minutes", data, tension: 0.3 }]
      }
    }
  );
}

function renderWeekday() {
  resetChart("weekday");

  const res = db.exec(`
    SELECT strftime('%w',start_time,'unixepoch'), SUM(duration)/3600
    FROM page_stat_data
    GROUP BY 1
  `);

  const names = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const vals = Array(7).fill(0);

  res[0].values.forEach(v => vals[+v[0]] = v[1]);

  charts.weekday = new Chart(
    document.getElementById("weekdayChart"),
    {
      type: "bar",
      data: {
        labels: names,
        datasets: [{ label: "Hours", data: vals }]
      }
    }
  );
}

