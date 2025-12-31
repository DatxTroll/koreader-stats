const fileInput = document.getElementById("fileInput");
const summaryDiv = document.getElementById("summary");
const booksTableBody = document.querySelector("#booksTable tbody");

let parsedStats = null;

fileInput.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const text = await file.text();
  parsedStats = parseLuaStats(text);

  renderSummary(parsedStats);
  renderBooks(parsedStats);
  renderDailyChart(parsedStats);
});

function parseLuaStats(luaText) {
  const { lua, lauxlib, lualib, to_js } = fengari;
  const L = lauxlib.luaL_newstate();
  lualib.luaL_openlibs(L);

  lauxlib.luaL_dostring(L, luaText);
  const result = to_js(L, -1);

  return result;
}

function renderSummary(stats) {
  let totalSeconds = 0;

  Object.values(stats.books || {}).forEach(b => {
    totalSeconds += b.total_time || 0;
  });

  summaryDiv.innerHTML = `
    <h2>Total Reading Time</h2>
    <p>${(totalSeconds / 3600).toFixed(1)} hours</p>
  `;
}

function renderBooks(stats) {
  booksTableBody.innerHTML = "";

  Object.values(stats.books || {}).forEach(book => {
    const row = document.createElement("tr");

    row.innerHTML = `
      <td>${book.title || "Unknown"}</td>
      <td>${book.authors || ""}</td>
      <td>${((book.total_time || 0) / 3600).toFixed(1)}</td>
      <td>${book.pages || ""}</td>
    `;

    booksTableBody.appendChild(row);
  });
}

function renderDailyChart(stats) {
  if (!stats.daily) return;

  const labels = Object.keys(stats.daily);
  const data = Object.values(stats.daily).map(v => v / 3600);

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
  if (!parsedStats) return;

  let csv = "Title,Author,TotalHours,Pages\n";

  Object.values(parsedStats.books || {}).forEach(b => {
    csv += `"${b.title}","${b.authors}",${(b.total_time/3600).toFixed(2)},${b.pages}\n`;
  });

  download(csv, "koreader_books.csv");
};

document.getElementById("exportJson").onclick = () => {
  if (!parsedStats) return;
  download(JSON.stringify(parsedStats, null, 2), "koreader_stats.json");
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
