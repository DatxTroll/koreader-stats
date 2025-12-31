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

// ===== SQL.JS =====
initSqlJs({
  locateFile: f =>
    `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.2/${f}`
}).then(sql => SQL = sql);

// ===== EVENTS =====
fileInput.addEventListener("change", loadDatabase);

minMinutesInput.addEventListener("input", () => {
  minMinutesValue.textContent = `${minMinutesInput.value} min`;
  if (db) renderAll();
});

document.querySelectorAll("#booksTable th").forEach(th => {
  th.onclick = () => {
    const col = th.dataset.sort;
    sortAsc = sortColumn === col ? !sortAsc : true;
    sortColumn = col;
    renderBooks();
  };
});

document.querySelectorAll(".sizes button").forEach(btn => {
  btn.onclick = () => {
    const card = btn.closest(".card");
    card.classList.remove("small", "medium", "large");
    card.classList.add(btn.dataset.size);
    setTimeout(renderAll, 50);
  };
});

// ===== DB =====
async function loadDatabase(e) {
  const file = e.target.files[0];
  if (!file) return;
  const buffer = await file.arrayBuffer();
  db = new SQL.Database(new Uint8Array(buffer));
  renderAll();
}

// ===== RENDER =====
function renderAll() {
  renderSummary();
  renderBooks();
  renderBooksPie();
  renderDailyChart();
  renderCumulativeChart();
  renderWeekdayChart();
}

function resetChart(id) {
  if (charts[id]) charts[id].destroy();
}

// ===== SUMMARY =====
function renderSummary() {
  const res = db.exec(`SELECT SUM(total_read_time) FROM book`);
  const s = res[0]?.values[0][0] || 0;
  summaryDiv.innerHTML = `<p><strong>${(s/3600).toFixed(1)}</strong> hours read</p>`;
}

// ===== BOOKS =====
function renderBooks() {
  booksTableBody.innerHTML = "";
  const minS = minMinutesInput.value * 60;
  const dir = sortAsc ? "ASC" : "DESC";

  const res = db.exec(`
    SELECT title, GROUP_CONCAT(authors), SUM(total_read_time)
    FROM book
    WHERE total_read_time >= ${minS}
    GROUP BY title
    ORDER BY ${sortColumn} ${dir}
  `);

  res[0]?.values.forEach(([t,a,s]) => {
    booksTableBody.innerHTML += `
      <tr><td>${t}</td><td>${a||""}</td><td>${(s/3600).toFixed(1)}</td></tr>
    `;
  });
}

// ===== CHARTS =====
function renderBooksPie() {
  resetChart("booksPie");
  const minS = minMinutesInput.value * 60;
  const r = db.exec(`
    SELECT title, SUM(total_read_time)
    FROM book WHERE total_read_time >= ${minS}
    GROUP BY title ORDER BY 2 DESC
  `);
  charts.booksPie = new Chart(booksPie, {
    type: "pie",
    data: {
      labels: r[0].values.map(v=>v[0]),
      datasets: [{ data: r[0].values.map(v=>(v[1]/3600).toFixed(2)) }]
    },
    options: { responsive:true, maintainAspectRatio:false }
  });
}

function renderDailyChart() {
  resetChart("dailyChart");
  const r = db.exec(`
    SELECT date(start_time,'unixepoch'), SUM(duration)/3600
    FROM page_stat_data GROUP BY 1 ORDER BY 1
  `);
  charts.dailyChart = new Chart(dailyChart, {
    type:"bar",
    data:{ labels:r[0].values.map(v=>v[0]), datasets:[{data:r[0].values.map(v=>v[1])}]},
    options:{ responsive:true, maintainAspectRatio:false }
  });
}

function renderCumulativeChart() {
  resetChart("cumulativeChart");
  const r = db.exec(`
    SELECT date(start_time,'unixepoch'), SUM(duration)/60
    FROM page_stat_data GROUP BY 1 ORDER BY 1
  `);
  let t=0;
  charts.cumulativeChart = new Chart(cumulativeChart,{
    type:"line",
    data:{ labels:r[0].values.map(v=>v[0]),
      datasets:[{data:r[0].values.map(v=>(t+=v[1])),fill:true}]},
    options:{ responsive:true, maintainAspectRatio:false }
  });
}

function renderWeekdayChart() {
  resetChart("weekdayChart");
  const r = db.exec(`
    SELECT strftime('%w',start_time,'unixepoch'), SUM(duration)/3600
    FROM page_stat_data GROUP BY 1
  `);
  const d=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"], v=Array(7).fill(0);
  r[0].values.forEach(([i,h])=>v[i]=h);
  charts.weekdayChart = new Chart(weekdayChart,{
    type:"bar",
    data:{ labels:d, datasets:[{data:v}]},
    options:{ responsive:true, maintainAspectRatio:false }
  });
}
