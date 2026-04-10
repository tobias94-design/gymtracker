import * as XLSX from 'xlsx';

/**
 * Parses the Excel workout file.
 * Expected format: multiple blocks in a sheet (or multiple sheets),
 * each block = one workout day.
 * Structure per block:
 *   Row 0: SETTIMANA 1  (merged) | SETTIMANA 2 | SETTIMANA 3 | SETTIMANA 4
 *   Row 1: ESERCIZIO | SERIE | RIPETIZIONI | RECUPERO | KG  (x4 weeks)
 *   Row 2+: exercises
 */

export function parseWorkoutExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const schedule = { name: '', days: [], weeks: 4 };

        workbook.SheetNames.forEach((sheetName, sheetIdx) => {
          const ws = workbook.Sheets[sheetName];
          const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

          // Find all blocks (separated by SETTIMANA header rows)
          const blockStartRows = [];
          raw.forEach((row, i) => {
            if (row && row.some((c) => typeof c === 'string' && c.trim().startsWith('SETTIMANA 1'))) {
              blockStartRows.push(i);
            }
          });

          blockStartRows.forEach((startRow, blockIdx) => {
            const endRow = blockStartRows[blockIdx + 1] ?? raw.length;
            const block = raw.slice(startRow, endRow);

            // Detect number of weeks from header row
            const headerRow = block[0];
            const weekCount = headerRow
              ? headerRow.filter((c) => typeof c === 'string' && c.trim().startsWith('SETTIMANA')).length
              : 4;

            // Column mapping: each week has 5 cols (ESERCIZIO, SERIE, RIPS, REC, KG)
            // Col 0 = exercise name, then groups of 4 (serie, rips, rec, kg) per week
            const exercises = [];
            for (let r = 2; r < block.length; r++) {
              const row = block[r];
              if (!row || !row[0]) continue;
              const exName = String(row[0]).trim();
              if (!exName || exName.startsWith('SETTIMANA')) continue;

              const weekData = [];
              for (let w = 0; w < weekCount; w++) {
                const baseCol = 1 + w * 4;
                weekData.push({
                  week: w + 1,
                  serie: row[baseCol] ?? null,
                  ripetizioni: row[baseCol + 1] ?? null,
                  recupero: row[baseCol + 2] ?? null,
                  kg: row[baseCol + 3] ?? null,
                });
              }

              exercises.push({ name: exName, weekData });
            }

            if (exercises.length > 0) {
              const dayLabel = blockIdx === 0 ? 'A' : blockIdx === 1 ? 'B' : blockIdx === 2 ? 'C' : 'D';
              schedule.days.push({
                id: `${sheetIdx}-${blockIdx}`,
                label: `Giorno ${dayLabel}`,
                sheetName,
                exercises,
                weeks: weekCount,
              });
            }
          });
        });

        schedule.weeks = schedule.days[0]?.weeks ?? 4;
        resolve(schedule);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

export function serializeSchedule(schedule) {
  return JSON.parse(JSON.stringify(schedule));
}
