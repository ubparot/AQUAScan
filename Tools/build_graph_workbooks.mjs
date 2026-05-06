import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const outputsDir = path.join(rootDir, "outputs", "graph-data-workbooks");

const colors = {
  title: "#0f172a",
  band: "#0f766e",
  subBand: "#dbeafe",
  surface: "#f8fafc",
  border: "#cbd5e1",
  text: "#1e293b",
  muted: "#64748b",
  accent: "#1d4ed8",
};

const sensorMeta = {
  temperature: { label: "Temperature", unit: "deg C" },
  ph: { label: "pH", unit: "pH" },
  do: { label: "Dissolved Oxygen", unit: "mg/L" },
  salinity: { label: "Salinity", unit: "ppt" },
  tds: { label: "Total Dissolved Solids", unit: "ppm" },
  conductivity: { label: "Conductivity", unit: "uS/cm" },
  turbidity: { label: "Turbidity", unit: "NTU" },
  light: { label: "Light", unit: "lux" },
  uv: { label: "Ultraviolet", unit: "index" },
  battery: { label: "Battery", unit: "%" },
  speed: { label: "Vessel Speed", unit: "m/s" },
  heading: { label: "Heading", unit: "deg" },
};

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines[0].split(",").map((value) => value.trim());
  return lines.slice(1).filter(Boolean).map((line) => {
    const values = line.split(",");
    const row = {};
    headers.forEach((header, index) => {
      const raw = (values[index] ?? "").trim();
      if (header === "timestamp") {
        row[header] = raw;
      } else {
        row[header] = Number(raw);
      }
    });
    return row;
  });
}

function addElapsed(rows) {
  const first = new Date(rows[0].timestamp).getTime();
  return rows.map((row, index) => ({
    ...row,
    sample_index: index + 1,
    elapsed_s: (new Date(row.timestamp).getTime() - first) / 1000,
  }));
}

function addLocalXY(rows) {
  const originLat = rows[0].latitude;
  const originLon = rows[0].longitude;
  const metersPerDegLat = 111320;
  const metersPerDegLon = metersPerDegLat * Math.cos((originLat * Math.PI) / 180);
  return rows.map((row) => ({
    ...row,
    x_m: (row.longitude - originLon) * metersPerDegLon,
    y_m: (row.latitude - originLat) * metersPerDegLat,
  }));
}

function prepareDepthProfile(rows) {
  const grouped = new Map();
  for (const row of rows) {
    const key = row.depth.toFixed(3);
    if (!grouped.has(key)) {
      grouped.set(key, { depth: row.depth, rows: [] });
    }
    grouped.get(key).rows.push(row);
  }

  return [...grouped.values()]
    .sort((a, b) => a.depth - b.depth)
    .map(({ depth, rows: groupedRows }) => {
      const profile = { depth };
      for (const key of ["temperature", "ph", "do", "salinity", "tds", "conductivity", "turbidity", "light", "uv"]) {
        profile[key] = groupedRows.reduce((sum, row) => sum + row[key], 0) / groupedRows.length;
      }
      return profile;
    });
}

function rangeAddress(columnLetter, startRow, endRow) {
  return `${columnLetter}${startRow}:${columnLetter}${endRow}`;
}

function setColumnWidths(sheet, widths) {
  widths.forEach((widthPx, index) => {
    sheet.getRangeByIndexes(0, index, 1, 1).format.columnWidthPx = widthPx;
  });
}

function styleTitle(range, title) {
  range.merge();
  range.values = [[title]];
  range.format = {
    fill: colors.title,
    font: { bold: true, color: "#ffffff", size: 18 },
    horizontalAlignment: "Center",
    verticalAlignment: "Center",
  };
}

function styleSection(range, title) {
  range.merge();
  range.values = [[title]];
  range.format = {
    fill: colors.band,
    font: { bold: true, color: "#ffffff", size: 12 },
    horizontalAlignment: "Left",
    verticalAlignment: "Center",
  };
}

function styleHeader(range) {
  range.format = {
    fill: colors.subBand,
    font: { bold: true, color: colors.text },
    borders: { color: colors.border },
    horizontalAlignment: "Center",
    verticalAlignment: "Center",
  };
}

function styleBody(range) {
  range.format = {
    fill: "#ffffff",
    font: { color: colors.text, size: 10 },
    borders: { color: colors.border },
  };
}

function makeChart(sheet, chartType, sourceRange, title, fromCell, toCell, yAxisFormat) {
  const chart = sheet.charts.add(chartType, sourceRange);
  chart.title = title;
  chart.hasLegend = false;
  chart.xAxis = { axisType: "textAxis" };
  if (yAxisFormat) {
    chart.yAxis = { numberFormatCode: yAxisFormat };
  }
  chart.setPosition(fromCell, toCell);
  return chart;
}

function buildTwoColumnBlock(sheet, startColumnIndex, headerLeft, headerRight, rows) {
  const headerRange = sheet.getRangeByIndexes(0, startColumnIndex, 1, 2);
  headerRange.values = [[headerLeft, headerRight]];
  styleHeader(headerRange);
  if (rows.length > 0) {
    const bodyRange = sheet.getRangeByIndexes(1, startColumnIndex, rows.length, 2);
    bodyRange.values = rows;
    styleBody(bodyRange);
  }
  return sheet.getRangeByIndexes(0, startColumnIndex, rows.length + 1, 2);
}

function profileSheetRows(profileRows) {
  return profileRows.map((row) => [
    row.depth,
    row.temperature,
    row.ph,
    row.do,
    row.salinity,
    row.tds,
    row.conductivity,
    row.turbidity,
    row.light,
    row.uv,
  ]);
}

function operationSheetRows(rows) {
  return rows.map((row) => [row.sample_index, row.elapsed_s, row.battery, row.speed, row.heading]);
}

function areaSheetRows(rows) {
  return rows.map((row) => [
    row.sample_index,
    row.elapsed_s,
    row.latitude,
    row.longitude,
    row.x_m,
    row.y_m,
    row.depth,
    row.temperature,
    row.ph,
    row.do,
    row.salinity,
    row.tds,
    row.conductivity,
    row.turbidity,
    row.light,
    row.uv,
    row.battery,
    row.speed,
    row.heading,
  ]);
}

function addKpiBlock(sheet, startRow, title, formula, numberFormat = "0.0") {
  const titleRange = sheet.getRange(`A${startRow}:B${startRow}`);
  titleRange.merge();
  titleRange.values = [[title]];
  titleRange.format = {
    fill: colors.subBand,
    font: { bold: true, color: colors.text },
    borders: { color: colors.border },
  };

  const valueRange = sheet.getRange(`A${startRow + 1}:B${startRow + 2}`);
  valueRange.merge();
  valueRange.formulas = [[formula]];
  valueRange.format = {
    fill: "#ffffff",
    font: { bold: true, color: colors.accent, size: 16 },
    borders: { color: colors.border },
    horizontalAlignment: "Center",
    verticalAlignment: "Center",
    numberFormat,
  };
}

function addDashboardBase(sheet, title, subtitle) {
  sheet.showGridLines = false;
  setColumnWidths(sheet, [110, 110, 24, 90, 90, 24, 140, 140, 24, 140, 140, 24, 140, 140]);
  styleTitle(sheet.getRange("A1:N2"), title);
  sheet.getRange("A3:N3").merge();
  sheet.getRange("A3:N3").values = [[subtitle]];
  sheet.getRange("A3:N3").format = {
    fill: colors.surface,
    font: { color: colors.muted, size: 10 },
    horizontalAlignment: "Left",
  };
}

function addProfileSheet(workbook, sheetName, profileRows) {
  const sheet = workbook.worksheets.add(sheetName);
  sheet.showGridLines = false;
  setColumnWidths(sheet, [100, 110, 90, 120, 90, 120, 120, 110, 100, 100]);
  styleTitle(sheet.getRange("A1:J2"), `${sheetName.replace("_", " ")} Data`);
  const headers = [["Probe Depth (m)", "Temperature", "pH", "Dissolved Oxygen", "Salinity", "TDS", "Conductivity", "Turbidity", "Light", "UV"]];
  sheet.getRange("A4:J4").values = headers;
  styleHeader(sheet.getRange("A4:J4"));
  const bodyRange = sheet.getRange(`A5:J${4 + profileRows.length}`);
  bodyRange.values = profileSheetRows(profileRows);
  styleBody(bodyRange);
  sheet.freezePanes.freezeRows(4);
  sheet.getRange(`A5:A${4 + profileRows.length}`).format.numberFormat = "0.0";
  sheet.getRange(`B5:B${4 + profileRows.length}`).format.numberFormat = "0.0";
  sheet.getRange(`C5:C${4 + profileRows.length}`).format.numberFormat = "0.0";
  sheet.getRange(`D5:G${4 + profileRows.length}`).format.numberFormat = "0.0";
  sheet.getRange(`H5:H${4 + profileRows.length}`).format.numberFormat = "0.0";
  sheet.getRange(`I5:I${4 + profileRows.length}`).format.numberFormat = "0";
  sheet.getRange(`J5:J${4 + profileRows.length}`).format.numberFormat = "0.0";
  return sheet;
}

function addOperationsSheet(workbook, sheetName, rows) {
  const sheet = workbook.worksheets.add(sheetName);
  sheet.showGridLines = false;
  setColumnWidths(sheet, [90, 120, 100, 100, 100]);
  styleTitle(sheet.getRange("A1:E2"), `${sheetName.replace("_", " ")} Data`);
  sheet.getRange("A4:E4").values = [["Sample", "Elapsed Time (s)", "Battery (%)", "Vessel Speed (m/s)", "Heading (deg)"]];
  styleHeader(sheet.getRange("A4:E4"));
  const bodyRange = sheet.getRange(`A5:E${4 + rows.length}`);
  bodyRange.values = operationSheetRows(rows);
  styleBody(bodyRange);
  sheet.freezePanes.freezeRows(4);
  sheet.getRange(`A5:B${4 + rows.length}`).format.numberFormat = "0";
  sheet.getRange(`C5:C${4 + rows.length}`).format.numberFormat = "0.0";
  sheet.getRange(`D5:D${4 + rows.length}`).format.numberFormat = "0.00";
  sheet.getRange(`E5:E${4 + rows.length}`).format.numberFormat = "0";
  return sheet;
}

function addAreaSheet(workbook, sheetName, rows) {
  const sheet = workbook.worksheets.add(sheetName);
  sheet.showGridLines = false;
  setColumnWidths(sheet, [70, 90, 95, 95, 90, 90, 90, 100, 70, 110, 80, 90, 110, 90, 90, 70, 80, 90, 80]);
  styleTitle(sheet.getRange("A1:S2"), "Pond Area Map Source Data");
  sheet.getRange("A4:S4").values = [[
    "Sample",
    "Elapsed (s)",
    "Latitude",
    "Longitude",
    "X from start (m)",
    "Y from start (m)",
    "Depth (m)",
    "Temperature",
    "pH",
    "Dissolved Oxygen",
    "Salinity",
    "TDS",
    "Conductivity",
    "Turbidity",
    "Light",
    "UV",
    "Battery",
    "Speed",
    "Heading",
  ]];
  styleHeader(sheet.getRange("A4:S4"));
  const bodyRange = sheet.getRange(`A5:S${4 + rows.length}`);
  bodyRange.values = areaSheetRows(rows);
  styleBody(bodyRange);
  sheet.freezePanes.freezeRows(4);
  return sheet;
}

function addChartDataSheet(workbook, sheetName, profileRows, operationRows) {
  const sheet = workbook.worksheets.add(sheetName);
  sheet.showGridLines = false;
  setColumnWidths(sheet, new Array(24).fill(92));
  styleTitle(sheet.getRange("A1:X2"), `${sheetName.replaceAll("_", " ")} Source`);

  const blocks = {
    temperature: buildTwoColumnBlock(sheet, 0, "Probe Depth (m)", "Temperature", profileRows.map((row) => [row.depth, row.temperature])),
    ph: buildTwoColumnBlock(sheet, 3, "Probe Depth (m)", "pH", profileRows.map((row) => [row.depth, row.ph])),
    do: buildTwoColumnBlock(sheet, 6, "Probe Depth (m)", "Dissolved Oxygen", profileRows.map((row) => [row.depth, row.do])),
    turbidity: buildTwoColumnBlock(sheet, 9, "Probe Depth (m)", "Turbidity", profileRows.map((row) => [row.depth, row.turbidity])),
    light: buildTwoColumnBlock(sheet, 12, "Probe Depth (m)", "Light", profileRows.map((row) => [row.depth, row.light])),
    uv: buildTwoColumnBlock(sheet, 15, "Probe Depth (m)", "Ultraviolet", profileRows.map((row) => [row.depth, row.uv])),
    battery: buildTwoColumnBlock(sheet, 18, "Elapsed Time (s)", "Battery", operationRows.map((row) => [row.elapsed_s, row.battery])),
    speed: buildTwoColumnBlock(sheet, 21, "Elapsed Time (s)", "Vessel Speed", operationRows.map((row) => [row.elapsed_s, row.speed])),
  };
  return { sheet, blocks };
}

function addPondWorkbook(pendingRows, profileRows) {
  const workbook = Workbook.create();
  const dashboard = workbook.worksheets.add("Dashboard");
  addDashboardBase(dashboard, "AquaScan Pond Graph Workbook", "Profile charts mirror the pond graph PNG set. Area sheet contains the XY source data behind the spatial maps.");
  addKpiBlock(dashboard, 5, "Profile Samples", "=COUNTA(Pond_Profile!A5:A200)", "0");
  addKpiBlock(dashboard, 9, "Min Depth (m)", "=MIN(Pond_Profile!A5:A200)", "0.0");
  addKpiBlock(dashboard, 13, "Max Depth (m)", "=MAX(Pond_Profile!A5:A200)", "0.0");
  addKpiBlock(dashboard, 17, "Area Samples", "=COUNTA(Pond_Area!A5:A200)", "0");
  addKpiBlock(dashboard, 21, "Avg Turbidity", "=AVERAGE(Pond_Profile!H5:H200)", "0.0");

  const profileSheet = addProfileSheet(workbook, "Pond_Profile", profileRows);
  const operationsSheet = addOperationsSheet(workbook, "Pond_Operations", pendingRows);
  addAreaSheet(workbook, "Pond_Area", pendingRows);
  const chartData = addChartDataSheet(workbook, "Pond_Chart_Data", profileRows, pendingRows);

  styleSection(dashboard.getRange("D5:N5"), "Pond Profile Charts");
  makeChart(dashboard, "line", chartData.blocks.temperature, "Temperature vs Probe Depth", "D6", "I20", "0.0");
  makeChart(dashboard, "line", chartData.blocks.ph, "pH vs Probe Depth", "J6", "N20", "0.0");
  makeChart(dashboard, "line", chartData.blocks.do, "Dissolved Oxygen vs Probe Depth", "D21", "I35", "0.0");
  makeChart(dashboard, "line", chartData.blocks.turbidity, "Turbidity vs Probe Depth", "J21", "N35", "0.0");

  styleSection(dashboard.getRange("D37:N37"), "Light / UV / Operations");
  makeChart(dashboard, "line", chartData.blocks.light, "Light vs Probe Depth", "D38", "I52", "0");
  makeChart(dashboard, "line", chartData.blocks.uv, "UV vs Probe Depth", "J38", "N52", "0.0");
  makeChart(dashboard, "line", chartData.blocks.battery, "Battery vs Elapsed Time", "D53", "I67", "0.0");
  makeChart(dashboard, "line", chartData.blocks.speed, "Speed vs Elapsed Time", "J53", "N67", "0.00");

  return workbook;
}

function addPoolWorkbook(rows, profileRows) {
  const workbook = Workbook.create();
  const dashboard = workbook.worksheets.add("Dashboard");
  addDashboardBase(dashboard, "AquaScan Pool Graph Workbook", "Profile charts mirror the pool graph PNG set. Operations sheet tracks battery, heading, and vessel speed over elapsed time.");
  addKpiBlock(dashboard, 5, "Profile Samples", "=COUNTA(Pool_Profile!A5:A200)", "0");
  addKpiBlock(dashboard, 9, "Min Depth (m)", "=MIN(Pool_Profile!A5:A200)", "0.0");
  addKpiBlock(dashboard, 13, "Max Depth (m)", "=MAX(Pool_Profile!A5:A200)", "0.0");
  addKpiBlock(dashboard, 17, "Avg pH", "=AVERAGE(Pool_Profile!C5:C200)", "0.00");
  addKpiBlock(dashboard, 21, "Avg Turbidity", "=AVERAGE(Pool_Profile!H5:H200)", "0.00");

  const profileSheet = addProfileSheet(workbook, "Pool_Profile", profileRows);
  const operationsSheet = addOperationsSheet(workbook, "Pool_Operations", rows);
  const chartData = addChartDataSheet(workbook, "Pool_Chart_Data", profileRows, rows);

  styleSection(dashboard.getRange("D5:N5"), "Pool Profile Charts");
  makeChart(dashboard, "line", chartData.blocks.temperature, "Temperature vs Probe Depth", "D6", "I20", "0.0");
  makeChart(dashboard, "line", chartData.blocks.ph, "pH vs Probe Depth", "J6", "N20", "0.00");
  makeChart(dashboard, "line", chartData.blocks.do, "Dissolved Oxygen vs Probe Depth", "D21", "I35", "0.0");
  makeChart(dashboard, "line", chartData.blocks.turbidity, "Turbidity vs Probe Depth", "J21", "N35", "0.00");

  styleSection(dashboard.getRange("D37:N37"), "Light / UV / Operations");
  makeChart(dashboard, "line", chartData.blocks.light, "Light vs Probe Depth", "D38", "I52", "0");
  makeChart(dashboard, "line", chartData.blocks.uv, "UV vs Probe Depth", "J38", "N52", "0.0");
  makeChart(dashboard, "line", chartData.blocks.battery, "Battery vs Elapsed Time", "D53", "I67", "0.0");
  makeChart(dashboard, "line", chartData.blocks.speed, "Speed vs Elapsed Time", "J53", "N67", "0.00");

  return workbook;
}

async function renderWorkbook(workbook, outputDir, name, sheets) {
  for (const sheetName of sheets) {
    const blob = await workbook.render({ sheetName, autoCrop: "all", scale: 1, format: "png" });
    await fs.writeFile(path.join(outputDir, `${name}-${sheetName}.png`), new Uint8Array(await blob.arrayBuffer()));
  }
}

async function verifyWorkbook(workbook, summarySheet) {
  const inspect = await workbook.inspect({
    kind: "table",
    range: `${summarySheet}!A1:N24`,
    include: "values,formulas",
    tableMaxRows: 24,
    tableMaxCols: 14,
  });
  console.log(inspect.ndjson);
  const errors = await workbook.inspect({
    kind: "match",
    searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
    options: { useRegex: true, maxResults: 50 },
    summary: `${summarySheet} formula error scan`,
  });
  console.log(errors.ndjson);
}

async function saveWorkbook(workbook, outputPath) {
  const output = await SpreadsheetFile.exportXlsx(workbook);
  await output.save(outputPath);
}

async function main() {
  await fs.mkdir(outputsDir, { recursive: true });
  const pondRaw = parseCsv(await fs.readFile(path.join(rootDir, "Assets", "StreamingAssets", "demo-mission.csv"), "utf8"));
  const poolRaw = parseCsv(await fs.readFile(path.join(rootDir, "Assets", "StreamingAssets", "pool-demo-mission.csv"), "utf8"));

  const pondRows = addLocalXY(addElapsed(pondRaw));
  const poolRows = addElapsed(poolRaw);
  const pondProfile = prepareDepthProfile(pondRows);
  const poolProfile = prepareDepthProfile(poolRows);

  const pondWorkbook = addPondWorkbook(pondRows, pondProfile);
  const poolWorkbook = addPoolWorkbook(poolRows, poolProfile);

  await renderWorkbook(pondWorkbook, outputsDir, "pond", ["Dashboard", "Pond_Profile", "Pond_Area", "Pond_Operations"]);
  await renderWorkbook(poolWorkbook, outputsDir, "pool", ["Dashboard", "Pool_Profile", "Pool_Operations"]);

  await verifyWorkbook(pondWorkbook, "Dashboard");
  await verifyWorkbook(poolWorkbook, "Dashboard");

  await saveWorkbook(pondWorkbook, path.join(outputsDir, "AquaScan_Pond_Graph_Data.xlsx"));
  await saveWorkbook(poolWorkbook, path.join(outputsDir, "AquaScan_Pool_Graph_Data.xlsx"));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
