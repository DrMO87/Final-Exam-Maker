import * as XLSX from 'xlsx';

/**
 * Returns an abbreviated course name for a given course title.
 * Standardizes common pharmacy, medical, and general academic course terms.
 */
export function getAbbreviatedCourseName(title) {
  if (!title) return '';

  const replacements = [
    [/\bPharmaceutical Analytical Chemistry\b/gi, 'Pharm. Anal. Chem.'],
    [/\bPharmaceutical Organic Chemistry\b/gi, 'Pharm. Org. Chem.'],
    [/\bPharmaceutical Chemistry\b/gi, 'Pharm. Chem.'],
    [/\bPharmaceutical Technology\b/gi, 'Pharm. Tech.'],
    [/\bPharmaceutical\b/gi, 'Pharm.'],
    [/\bPharmacology\b/gi, 'Pharmacol.'],
    [/\bPharmacognosy\b/gi, 'Pharmacog.'],
    [/\bPharmaceutics\b/gi, 'Pharmaceut.'],
    [/\bPharmacokinetics\b/gi, 'Pharm. Kinetics'],
    [/\bPharmacotherapy\b/gi, 'Pharmacother.'],
    [/\bPharmacovigilance\b/gi, 'PharmVigilance'],
    [/\bPharmacoeconomics\b/gi, 'PharmEcon.'],
    [/\bPhytochemistry\b/gi, 'Phytochem.'],
    [/\bPhytotherapy\b/gi, 'Phytother.'],
    [/\bBiochemistry\b/gi, 'Biochem.'],
    [/\bMicrobiology\b/gi, 'Microbiol.'],
    [/\bImmunology\b/gi, 'Immunol.'],
    [/\bChemistry\b/gi, 'Chem.'],
    [/\bOrganic\b/gi, 'Org.'],
    [/\bAnalytical\b/gi, 'Anal.'],
    [/\bMedicinal\b/gi, 'Med.'],
    [/\bTechnology\b/gi, 'Tech.'],
    [/\bManagement\b/gi, 'Mgmt.'],
    [/\bCommunication\b/gi, 'Comm.'],
    [/\bPresentation\b/gi, 'Present.'],
    [/\bNeurological\b/gi, 'Neurol.'],
    [/\bPsychiatric\b/gi, 'Psych.'],
    [/\bRespiratory\b/gi, 'Resp.'],
    [/\bDevelopment\b/gi, 'Dev.'],
    [/\bPathophysiology\b/gi, 'Pathophys.'],
    [/\bTherapeutics\b/gi, 'Therap.'],
    [/\bClinical\b/gi, 'Clin.'],
    [/\bInformation\b/gi, 'Info.'],
    [/\bOrientation\b/gi, 'Orient.'],
    [/\bPhysiology\b/gi, 'Physiol.'],
    [/\bHistology\b/gi, 'Histol.'],
    [/\bAnatomy\b/gi, 'Anat.'],
    [/\bBiopharmaceutics\b/gi, 'Biopharm.'],
    [/\bPreparations\b/gi, 'Prep.'],
    [/\bDiseases\b/gi, 'Dis.'],
    [/\bDisease\b/gi, 'Dis.'],
  ];

  let abbrev = title.trim();
  for (const [pattern, replacement] of replacements) {
    abbrev = abbrev.replace(pattern, replacement);
  }

  return abbrev;
}

/**
 * Downloads the Data Audit & Validation Table as an Excel workbook (.xlsx).
 */
export function exportValidationMatrixToExcel(courses, conflictMap, sessionId = 'export') {
  const matrixRows = courses.map(c => {
    const conflicts = conflictMap.get(String(c.id)) || [];
    const conflictStr = conflicts.map(item => 
      `${getAbbreviatedCourseName(item.target.course_title)} (${item.target.program}): ${item.overlap} overlap`
    ).join('; ');

    return {
      'Course Code': c.course_code,
      'Course Title': c.course_title,
      'Abbreviated Name': getAbbreviatedCourseName(c.course_title),
      'Program': c.program,
      'Level': c.level,
      'Students Enrolled': c.student_count || 0,
      'Oral Exam': c.has_oral_exam ? 'Period 1 Only' : 'No',
      'Conflicts Count': conflicts.length,
      'Conflicted Courses & Overlap': conflictStr || 'None'
    };
  });

  const wb = XLSX.utils.book_new();
  const wsMatrix = XLSX.utils.json_to_sheet(matrixRows);
  
  wsMatrix['!cols'] = [
    { wch: 14 }, // Course Code
    { wch: 42 }, // Course Title
    { wch: 30 }, // Abbreviated Name
    { wch: 18 }, // Program
    { wch: 8 },  // Level
    { wch: 18 }, // Students Enrolled
    { wch: 15 }, // Oral Exam
    { wch: 16 }, // Conflicts Count
    { wch: 60 }  // Conflicted Courses
  ];

  XLSX.utils.book_append_sheet(wb, wsMatrix, 'Validation Matrix');

  // Detailed Conflict Pairs sheet
  const conflictPairsRows = [];
  const processedPairs = new Set();

  courses.forEach(c => {
    const conflicts = conflictMap.get(String(c.id)) || [];
    conflicts.forEach(item => {
      const pairKey = [c.id, item.target.id].sort().join('-');
      if (!processedPairs.has(pairKey)) {
        processedPairs.add(pairKey);
        conflictPairsRows.push({
          'Course A Code': c.course_code,
          'Course A Abbrev Name': getAbbreviatedCourseName(c.course_title),
          'Course A Program': c.program,
          'Course A Level': c.level,
          'Course B Code': item.target.course_code,
          'Course B Abbrev Name': getAbbreviatedCourseName(item.target.course_title),
          'Course B Program': item.target.program,
          'Course B Level': item.target.level,
          'Student Overlap Count': item.overlap
        });
      }
    });
  });

  const wsConflicts = XLSX.utils.json_to_sheet(conflictPairsRows);
  wsConflicts['!cols'] = [
    { wch: 14 }, { wch: 30 }, { wch: 18 }, { wch: 8 },
    { wch: 14 }, { wch: 30 }, { wch: 18 }, { wch: 8 },
    { wch: 22 }
  ];
  XLSX.utils.book_append_sheet(wb, wsConflicts, 'Detailed Conflicts');

  const filename = `data-validation-table-${sessionId}.xlsx`;
  XLSX.writeFile(wb, filename);
}

/**
 * Downloads the Data Audit & Validation Table as a CSV file.
 */
export function exportValidationMatrixToCSV(courses, conflictMap, sessionId = 'export') {
  const matrixRows = courses.map(c => {
    const conflicts = conflictMap.get(String(c.id)) || [];
    const conflictStr = conflicts.map(item => 
      `${getAbbreviatedCourseName(item.target.course_title)} (${item.target.program}): ${item.overlap} overlap`
    ).join('; ');

    return {
      'Course Code': c.course_code,
      'Course Title': c.course_title,
      'Abbreviated Name': getAbbreviatedCourseName(c.course_title),
      'Program': c.program,
      'Level': c.level,
      'Students Enrolled': c.student_count || 0,
      'Oral Exam': c.has_oral_exam ? 'Period 1 Only' : 'No',
      'Conflicts Count': conflicts.length,
      'Conflicted Courses & Overlap': conflictStr || 'None'
    };
  });

  const ws = XLSX.utils.json_to_sheet(matrixRows);
  const csvOutput = XLSX.utils.sheet_to_csv(ws);
  const blob = new Blob([csvOutput], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `data-validation-table-${sessionId}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
