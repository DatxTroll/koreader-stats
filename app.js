let db;
let SQL;
let charts = {};

const fileInput = document.getElementById("fileInput");
const summaryDiv = document.getElementById("summary");
const booksTableBody = document.querySelector("#booksTable tbody");
const minMinutesInput = document.getElementById("minMinutes");
const minMinutesValue = document.getElementById("minMinutesValue");

minMinutesValue.textContent = `${minMinutesInput.value} min`;

minMinutesInput.addEventListener("input", () => {
  minMinutesValue.textContent = `${minMinutesInput.value} min`;
  if (!db) return;
  renderAll();
});

fileInput.disabled = true;

initSqlJs({
  locateFile: f =>
    `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.2/${f}`
}).then(sql => {
  SQL = sql;
  fileInput.disabled = false;
});

fileInput.addEventListener("change", async e => {
  const file = e.target.files[0];
  if (!file) return;

  const buffer = await file.arrayBuffer();
  db = new SQL.Database(new Uint8Array(buffer));
  renderAll();
});

function resetChart(id) {
  if (charts[id]) {
    charts[id].destroy();
    delete charts[id];
  }
}

function renderAll() {
  renderSummary();
  renderBooks();
  renderBooksPie();
  renderDailyChart();
  renderCumulativeChart();
  renderWeekdayChart();
}

function renderSummary() {
  const res = db.exec(`
    SELECT SUM(COALESCE(total_read_time,0))
    FROM book
  `);
  const seconds = res[0]?.values[0][0] || 0;
  summaryDiv.innerHTML = `
    <h3>Total</h3>
    <p>${(seconds / 3600).toFixed(1)} hrs</p>
  `;
}

function renderBooks() {
  booksTableBody.innerHTML = "";
  const minSeconds = minMinutesInput.value * 60;

  const res = db.exec(
    `
    SELECT title,
           GROUP_CONCAT(authors, ', '),
           SUM(COALESCE(total_read_time,0))
    FROM book
    WHERE total_read_time >= ?
    GROUP BY title
    ORDER BY 3 DESC
    `,
    [minSeconds]
  );

  res[0]?.values.forEach(([t, a, s]) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${t}</td>
      <td>${a || ""}</td>
      <td>${(s / 3600).toFixed(1)}</td>
    `;
    booksTableBody.appendChild(tr);
  });
}

function renderBooksPie() {
  resetChart("booksPie");

  const minSeconds = minMinutesInput.value * 60;
  const res = db.exec(
    `
    SELECT title, SUM(COALESCE(total_read_time,0))
    FROM book
    WHERE total_read_time >= ?
    GROUP BY title
    ORDER BY 2 DESC
    `,
    [minSeconds]
  );

  charts.booksPie = new Chart(
    document.getElementById("booksPie"),
    {
      type: "pie",
      data: {
        labels: res[0]?.values.map(r => r[0]),
        datasets: [{
          data: res[0]?.values.map(r => (r[1] / 3600).toFixed(2))
        }]
      }
    }
  );
}

function renderDailyChart() {
  resetChart("dailyChart");

  const res = db.exec(`
    SELECT date(start_time,'unixepoch'),
           SUM(duration)/3600.0
    FROM page_stat_data
    GROUP BY 1
    ORDER BY 1
  `);

  charts.dailyChart = new Chart(
    document.getElementById("dailyChart"),
    {
      type: "bar",
      data: {
        labels: res[0]?.values.map(r => r[0]),
        datasets: [{
          label: "Hours",
          data: res[0]?.values.map(r => r[1])
        }]
      }
    }
  );
}

function renderCumulativeChart() {
  resetChart("cumulativeChart");

  const res = db.exec(`
    SELECT date(start_time,'unixepoch'),
           SUM(duration)/60.0
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

function renderWeekdayChart() {
  resetChart("weekdayChart");

  const res = db.exec(`
    SELECT strftime('%w',start_time,'unixepoch'),
           SUM(duration)/3600.0
    FROM page_stat_data
    GROUP BY 1
  `);

  const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const data = Array(7).fill(0);

  res[0]?.values.forEach(([d,h]) => data[Number(d)] = h);

  charts.weekdayChart = new Chart(
    document.getElementById("weekdayChart"),
    {
      type: "bar",
      data: {
        labels: days,
        datasets: [{
          label: "Hours",
          data
        }]
      }
    }
  );
}
