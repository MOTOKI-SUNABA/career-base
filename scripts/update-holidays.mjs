import { mkdir, writeFile } from "node:fs/promises";

// Source: Cabinet Office, Japan. Store locally so calendars work offline.
const source = "https://www8.cao.go.jp/chosei/shukujitsu/syukujitsu.csv";
const response = await fetch(source);
if (!response.ok) throw new Error(`Holiday download failed: ${response.status}`);
const csv = new TextDecoder("shift-jis").decode(await response.arrayBuffer());
const holidays = {};
for (const line of csv.split(/\r?\n/).slice(1)) {
  if (!line.trim()) continue;
  const match = line.match(/^"?(\d{4})\/(\d{1,2})\/(\d{1,2})"?,"?([^"\r\n,]+)"?\s*$/);
  if (!match) throw new Error("Unexpected Cabinet Office CSV format");
  const [, year, month, day, name] = match;
  holidays[`${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`] = name.trim();
}
const dates = Object.keys(holidays).sort();
if (dates.length < 1000 || !Object.values(holidays).includes("文化の日")) throw new Error("Incomplete holiday data");
const directory = new URL("../src/data/", import.meta.url);
await mkdir(directory, { recursive: true });
await writeFile(new URL("japanese-holidays.json", directory), `${JSON.stringify({ source, sourcePage: "https://www8.cao.go.jp/chosei/shukujitsu/gaiyou.html", updatedAt: new Date().toISOString().slice(0, 10), firstYear: Number(dates[0].slice(0, 4)), lastYear: Number(dates.at(-1).slice(0, 4)), holidays }, null, 2)}\n`);
console.log(`Saved ${dates.length} Japanese holidays (${dates[0]} through ${dates.at(-1)}).`);
