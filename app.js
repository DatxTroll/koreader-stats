document.addEventListener("DOMContentLoaded", () => {
  let db = null;
  let SQL = null;
  let charts = [];

  const fileInput = document.getElementById("fileInput");
  const minMinutes = document.getElementById("minMinutes");
  const minLabel = document.getElementById("minLabel");
  const summary = document.getElementById("summary");
  const booksBody = document.querySelector("#booksTable tbody");

  minLabel.textContent = minMinutes.value;

  minMinutes.addEventListener("input", () => {
    minLabel.textContent = minMinutes.value;
    if (db) renderAll();
  });

  initSqlJs({
    locateFile: f =>
      `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.2/${f}`
  }).then(sql => {
    SQL = sql;
  });

  fileInput.addEventListener("change", async e => {
    const file = e.target.files[0];
    if (!file) return;

    const buf = await file.arrayBuffer();
    db = new SQL.Database(new Uint8Array(buf));
    renderAll();
  });

  function clearCharts() {
    charts.forEach(c => c.destroy());
    charts = [];
  }

  function renderAll() {
    clearCharts();
    renderSummary();
    renderBooks();
    renderPie();
    renderDaily();
    renderCumulative();
    renderWeekday();
  }

  function renderSummary() {
    const res = db.exec(`SELECT SUM(total_read_time) FROM book`);
    const secs = res[0]?.values[0][0] || 0;
    summary.innerHTML = `
      <h2>Total Reading</h2>
      <p>${(secs / 3600).toFixed(1)} hours</p>
    `;
  }

  function renderBooks() {
    booksBody.innerHTML = "";
    const minSec = minMinutes.value * 60;

    const res = db.exec(
      `
      SELECT
        title,
        GROUP_CONCAT(authors),
        SUM(total_read_time)
      FROM book
      WHERE total_read_time >= ?
      GROUP BY title
      ORDER BY SUM(total_read_time) DESC
      `,
      [minSec]
    );

    res[0]?.values.forEach(([t, a, s]) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${t}</td>
        <td>${a || ""}</td>
        <td>${(s / 3600).toFixed(2)}</td>
      `;
      booksBody.appendChild(tr);
    });
  }

  function renderPie() {
    const res = db.exec(`
      SELECT title, SUM(total_read_time)/3600
      FROM book
      GROUP BY title
      ORDER BY 2 DESC
    `);

    charts.push(new Chart(booksPie, {
      type: "pie",
      data: {
        labels: res[0].values.map(r => r[0]),
        datasets: [{ data: res[0].values.map(r => r[1]) }]
      }
    }));
  }

  function renderDaily() {
    const res = db.exec(`
      SELECT date(start_time,'unixepoch'), SUM(duration)/3600
      FROM page_stat_data
      GROUP BY 1
      ORDER BY 1
    `);

    charts.push(new Chart(dailyChart, {
      type: "bar",
      data: {
        labels: res[0].values.map(r => r[0]),
        datasets: [{ label: "Hours", data: res[0].values.map(r => r[1]) }]
      }
    }));
  }

  function renderCumulative() {
    const res = db.exec(`
      SELECT date(start_time,'unixepoch'), SUM(duration)/60
      FROM page_stat_data
      GROUP BY 1
      ORDER BY 1
    `);

    let total = 0;
    const labels = [];
    const data = [];

    res[0].values.forEach(([d, m]) => {
      total += m;
      labels.push(d);
      data.push(total);
    });

    charts.push(new Chart(cumulativeChart, {
      type: "line",
      data: {
        labels,
        datasets: [{ label: "Minutes", data, tension: 0.3 }]
      }
    }));
  }

  function renderWeekday() {
    const res = db.exec(`
      SELECT strftime('%w',start_time,'unixepoch'), SUM(duration)/3600
      FROM page_stat_data
      GROUP BY 1
    `);

    const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
    const data = Array(7).fill(0);

    res[0].values.forEach(([d,h]) => data[d] = h);

    charts.push(new Chart(weekdayChart, {
      type: "bar",
      data: {
        labels: days,
        datasets: [{ label: "Hours", data }]
      }
    }));
  }
});
