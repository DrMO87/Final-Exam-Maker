# Excel File Format Guide

This guide explains the exact format required for each Excel file uploaded to the PharmD Exam Scheduler.

## 1. Course Files

### File Names
- `pharmd_courses.xlsx` - PharmD program courses
- `clinical_pharmd_courses.xlsx` - PharmD Clinical program courses

### Required Columns

| Column Name | Type | Required | Description | Example |
|-------------|------|----------|-------------|---------|
| Course Code | Text | Yes | Unique course identifier | PHAR101 |
| Course Title | Text | Yes | Full course name | Pharmaceutical Chemistry |
| Semester | Text | Yes | Must contain "Level X" where X is 1-5 | Level 1; Semester 1 |
| Has Oral Exam | Text | No | Yes/No/True/False | Yes |
| Student Count | Number | No | Number of enrolled students | 150 |
| Credit Hours | Number | No | Course credit hours (default: 3) | 3 |
| Is Heavy | Text | No | Whether course is heavy (default: Yes) | Yes |
| Must Be First | Text | No | Must be first exam for level | No |

### Sample Data

```
Course Code | Course Title                    | Semester           | Has Oral Exam | Student Count | Credit Hours | Is Heavy | Must Be First
PHAR101     | Pharmaceutical Analytical Chem  | Level 1; Semester 1| Yes          | 150          | 3           | Yes      | No
PHAR102     | Pharmaceutical Organic Chem     | Level 1; Semester 1| Yes          | 150          | 3           | Yes      | No
PHAR103     | Medicinal Plants                | Level 1; Semester 1| Yes          | 150          | 2           | Yes      | No
PHAR104     | Cell Biology                    | Level 1; Semester 1| No           | 150          | 3           | Yes      | No
PHAR105     | Mathematics                     | Level 1; Semester 1| No           | 150          | 2           | No       | No
```

### Important Notes

1. **Semester Format**: Must include "Level X" text (case-insensitive)
   - ✅ "Level 1; Semester 1"
   - ✅ "level 2; semester 1"
   - ✅ "Level 3 - Fall"
   - ❌ "First Year" (no level number)

2. **Boolean Values**: Accepted formats
   - Yes/No
   - True/False
   - Y/N
   - 1/0
   - Case-insensitive

3. **Default Values**:
   - Has Oral Exam: No
   - Student Count: 0
   - Credit Hours: 3
   - Is Heavy: Yes
   - Must Be First: No

## 2. Conflict Matrix Files

### File Names
- `PharmD Conflict Fall 25-26.xlsx`
- `PharmD Clinical Conflict Fall 25-26.xlsx`

### Format

A symmetric matrix where:
- **Rows**: Course names/codes
- **Columns**: Course names/codes (same as rows)
- **Values**: Number of students taking both courses
- **Diagonal**: Usually empty or "-"
- **No conflict**: 0, blank, or "-"

### Sample Data

```
              | PHAR101 | PHAR102 | PHAR103 | PHAR104 | PHAR105
PHAR101       | -       | 25      | 10      | 30      | 0
PHAR102       | 25      | -       | 15      | 20      | 5
PHAR103       | 10      | 15      | -       | 12      | 8
PHAR104       | 30      | 20      | 12      | -       | 18
PHAR105       | 0       | 5       | 8       | 18      | -
```

### Important Notes

1. **Symmetry**: Matrix should be symmetric
   - Matrix[A][B] should equal Matrix[B][A]
   - If not symmetric, the system uses the first value found

2. **Course Names**: Must match course titles or codes from course files
   - Use exact same spelling and capitalization
   - Spaces matter

3. **Label Rows**: Rows/columns containing "Level (" are ignored
   - Example: "Level (1)" rows are skipped

4. **Missing Values**: Treated as 0 (no conflict)

## 3. Student Numbers File

### File Name
- `Courses Fall 25-26 with student numbers.xlsx`

### Required Columns

| Column Name | Type | Required | Description | Example |
|-------------|------|----------|-------------|---------|
| Course Code | Text | Yes | Must match course code from course files | PHAR101 |
| Student Count | Number | Yes | Number of enrolled students | 150 |

### Sample Data

```
Course Code | Student Count
PHAR101     | 150
PHAR102     | 148
PHAR103     | 152
PHAR104     | 145
PHAR105     | 150
```

### Important Notes

1. **Updates Existing Data**: This file updates student counts from course files
2. **Optional**: If not provided, uses counts from course files
3. **Course Code Match**: Must exactly match course codes in course files

## Common Issues and Solutions

### Issue: "Course not found in conflict matrix"
**Solution**: Ensure course names in conflict matrix exactly match course titles in course files

### Issue: "Level not detected"
**Solution**: Add "Level X" to the Semester column where X is 1-5

### Issue: "Duplicate course code"
**Solution**: Each course code must be unique within a program

### Issue: "Invalid boolean value"
**Solution**: Use Yes/No, True/False, Y/N, or 1/0 for boolean fields

## Excel Tips

### Creating Course Files

1. Use Excel or Google Sheets
2. First row must be column headers (exact names as shown)
3. Save as .xlsx or .xls format
4. Avoid merged cells
5. Avoid formulas in data cells (use values only)

### Creating Conflict Matrices

1. Create a square matrix
2. First row and first column are course names
3. Fill in overlap counts
4. Leave diagonal empty or use "-"
5. Ensure symmetry (optional but recommended)

### Validation Checklist

Before uploading, verify:

- [ ] All required columns present
- [ ] Column names spelled correctly
- [ ] "Level X" appears in Semester column
- [ ] Course codes are unique
- [ ] Boolean values use accepted formats
- [ ] Numbers are formatted as numbers (not text)
- [ ] File saved as .xlsx or .xls
- [ ] No empty rows in the middle of data
- [ ] Conflict matrix course names match course files

## Example Files Structure

### Minimal Course File
```
Course Code | Course Title      | Semester
PHAR101     | Chemistry         | Level 1; Semester 1
PHAR102     | Biology           | Level 1; Semester 1
```

### Complete Course File
```
Course Code | Course Title      | Semester           | Has Oral Exam | Student Count | Credit Hours | Is Heavy | Must Be First
PHAR101     | Chemistry         | Level 1; Semester 1| Yes          | 150          | 3           | Yes      | No
PHAR102     | Biology           | Level 1; Semester 1| No           | 148          | 3           | Yes      | No
```

### Minimal Conflict Matrix
```
        | PHAR101 | PHAR102
PHAR101 | -       | 25
PHAR102 | 25      | -
```

## Special Cases

### Level 5 Clinical - Industrial Pharmacy
```
Course Code | Course Title         | Semester           | Must Be First
PHAR501     | Industrial Pharmacy  | Level 5; Semester 1| Yes
```

### Level 5 PharmD - Phytotherapy
```
Course Code | Course Title  | Semester           | Must Be First
PHAR502     | Phytotherapy  | Level 5; Semester 1| Yes
```

### Level 4 - Medicinal Chemistry (2)
```
Course Code | Course Title            | Semester           | Must Be First
PHAR401     | Medicinal Chemistry (2) | Level 4; Semester 1| Yes
```

## Template Download

You can create template files with these structures and fill in your actual course data. The system is flexible with column order but strict with column names.

## Need Help?

If your Excel files aren't being parsed correctly:

1. Check the browser console for specific error messages
2. Verify column names match exactly (case-sensitive)
3. Ensure "Level X" appears in Semester column
4. Check for special characters or formatting issues
5. Try with a minimal file first (just required columns)

---

**Pro Tip**: Start with a small test file (5-10 courses) to verify the format works before uploading your complete dataset.

