import XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';

const sampleDir = 'd:/HUE/DEVELOPED SOFTWARE/Final Exam Maker/sample_data';
const files = fs.readdirSync(sampleDir).filter(f => f.endsWith('.xlsx'));

files.forEach(file => {
  const fullPath = path.join(sampleDir, file);
  const wb = XLSX.readFile(fullPath);
  const csvFileName = file.replace('.xlsx', '.csv');
  const csvPath = path.join(sampleDir, csvFileName);
  XLSX.writeFile(wb, csvPath, { bookType: 'csv' });
  console.log(`Converted ${file} -> ${csvFileName}`);
});

console.log('All sample files converted to CSV successfully!');
