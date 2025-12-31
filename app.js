let db = null;
let SQL = null;
let lastQueryResults = null;

const fileInput = document.getElementById("fileInput");
const summaryDiv = document.getElementById("summary");
const booksTableBody = document.querySelector("#booksTable tbody");

fileInput.disabled = true;
summaryDiv.innerHTML = "<p>Loading SQLite engine…</p>";

initSqlJs({
  locateFile: file =>
    `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.2/${file}`
}).then(sql => {
  SQL = sql;
  fileInput.disabled = false;
  summaryDiv.innerHTML = "<p>SQLite engine loaded. Upload your stats file.</p>";
  console.log("sql.js ready");
});

fileInput.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  console.log("File selected:", file.name);

  const buffer = await file.arrayBuffer();
  db = new SQL.Database(new Uint8Array(buffer));

  console.log("Database opened");

  inspectSchema();
  renderSummary();
  renderBooks();
  renderDailyChart();
});

function inspectSchema() {
  const res = db.exec(`
    SELECT name FROM sqlite_master
    WHERE type='table'
  `);

  const tables = res[0]?.values.flat() || [];
  console.log("Tables found:", tables);

  summaryDiv.innerHTML += `
    <p><strong>Tables:</strong> ${tables.join(", ")}</p>
  `;
}
function renderBooks() {
  booksTableBody.innerHTML = "";

  const res = db.exec(`
    SELECT
      title,
      authors,
      total_read_time
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


function renderBooks() {
  booksTableBody.innerHTML = "";

  const res = db.exec(`
    SELECT
      title,
      authors,
      total_read_time
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


function renderDailyChart() {
  const res = db.exec(`
    SELECT
      date(start_time, 'unixepoch') as day,
      SUM(duration) / 3600.0 as hours
    FROM page_stat_data
    GROUP BY day
    ORDER BY day
  `);

  if (!res.length) return;

  const labels = res[0].values.map(r => r[0]);
  const data = res[0].values.map(r => r[1]);

  new Chart(document.getElementById("dailyChart"), {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Hours Read",
        data
      }]
    }
  });
}


// EXPORTS

document.getElementById("exportCsv").onclick = () => {
  if (!lastQueryResults) return;

  let csv = lastQueryResults.columns.join(",") + "\n";
  lastQueryResults.values.forEach(r => {
    csv += r.map(v => `"${v}"`).join(",") + "\n";
  });

  download(csv, "koreader_books.csv");
};

document.getElementById("exportJson").onclick = () => {
  if (!lastQueryResults) return;

  const rows = lastQueryResults.values.map(r =>
    Object.fromEntries(
      lastQueryResults.columns.map((c, i) => [c, r[i]])
    )
  );

  download(JSON.stringify(rows, null, 2), "koreader_books.json");
};

function download(content, filename) {
  const blob = new Blob([content]);
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();

  URL.revokeObjectURL(url);
}
