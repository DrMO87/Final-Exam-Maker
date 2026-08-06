# 🎯 How to Use the PharmD Exam Scheduler

## ✅ You're at the Right Step!

The screenshot shows **"Generated Schedule (0 exams)"** - this is **normal**! 

You haven't uploaded any course data yet. Let me guide you through the process.

---

## 📋 Step-by-Step Guide

### **Step 1: Start the Application** ✅ (You've done this!)

```bash
.\start-sqlite.bat
```

The application is now running at http://localhost:3000

---

### **Step 2: Create a Session** ✅ (You've done this!)

You've already created a session. Great!

---

### **Step 3: Upload Excel Files** ⬅️ **YOU ARE HERE**

This is where you need to upload your course and conflict data.

#### **Required Files:**

You need to prepare Excel files with your course data. Here's what each file should contain:

#### **1. PharmD Courses File** (pharmd_courses.xlsx)

| Level | Course Code | Course Title | Credit Hours | Has Oral Exam | Is Heavy | Must Be First |
|-------|-------------|--------------|--------------|---------------|----------|---------------|
| 1 | PHAR101 | Pharmaceutical Chemistry I | 3 | No | No | No |
| 1 | PHAR102 | Pharmaceutics I | 4 | Yes | Yes | No |
| 2 | PHAR201 | Pharmacology I | 3 | No | No | No |
| ... | ... | ... | ... | ... | ... | ... |

**Column Details:**
- **Level**: 1, 2, 3, 4, or 5
- **Course Code**: Unique identifier (e.g., PHAR101)
- **Course Title**: Full course name
- **Credit Hours**: Number (usually 2-4)
- **Has Oral Exam**: "Yes" or "No"
- **Is Heavy**: "Yes" or "No" (heavy courses need more study time)
- **Must Be First**: "Yes" or "No" (must be scheduled early)

---

#### **2. PharmD Clinical Courses File** (clinical_courses.xlsx)

Same format as above, but for PharmD Clinical program courses.

---

#### **3. PharmD Conflicts File** (pharmd_conflicts.xlsx)

| Course A | Course B | Overlap Count |
|----------|----------|---------------|
| PHAR101 | PHAR102 | 45 |
| PHAR101 | PHAR103 | 38 |
| PHAR201 | PHAR202 | 52 |
| ... | ... | ... |

**Column Details:**
- **Course A**: Course code from courses file
- **Course B**: Course code from courses file
- **Overlap Count**: Number of students taking both courses

---

#### **4. PharmD Clinical Conflicts File** (clinical_conflicts.xlsx)

Same format as PharmD conflicts, but for Clinical program.

---

#### **5. Student Numbers File** (student_numbers.xlsx) - Optional

| Course Code | Student Count |
|-------------|---------------|
| PHAR101 | 120 |
| PHAR102 | 115 |
| ... | ... |

---

### **Step 4: Upload the Files**

1. **Click the "Upload Files" button** on the page
2. **Select your Excel files:**
   - PharmD Courses
   - PharmD Clinical Courses
   - PharmD Conflicts
   - PharmD Clinical Conflicts
   - Student Numbers (optional)
3. **Click "Upload & Process"**

The system will:
- ✅ Parse all Excel files
- ✅ Extract course data
- ✅ Extract conflict data
- ✅ Save everything to the database

---

### **Step 5: Generate Schedule** ⬅️ **NEXT STEP**

After uploading files, click **"Generate Schedule"**

The system will:
1. 🧬 **Run Genetic Algorithm** (50 generations)
2. 🔥 **Apply Simulated Annealing** (fine-tuning)
3. ✅ **Find optimal schedule** respecting all constraints

**This will take 10-30 seconds** depending on the number of courses.

You'll see console output like:
```
🧬 Starting Genetic Algorithm optimization...
📊 Courses: 45, Days: 18
✅ Initial population created. Best fitness: 2450
Generation 0: Best fitness = 2450
Generation 20: Best fitness = 850
Generation 40: Best fitness = 320
Generation 60: Best fitness = 125
Generation 80: Best fitness = 45
🔥 Applying Simulated Annealing for fine-tuning...
✅ Final fitness: 12
✅ Schedule generated: 45 exams, 0 violations
```

---

### **Step 6: View & Export Schedule**

Once generated, you'll see:
- **Generated Schedule (45 exams)** ← Number of courses scheduled
- **0 violations** ← All constraints satisfied!

You can:
- 📊 **View the schedule** in a table
- 📥 **Export to Markdown** for printing/sharing
- 🔄 **Regenerate** if you want to try different optimization

---

## 🎯 Quick Test with Sample Data

If you don't have Excel files ready, here's how to create a quick test:

### **Create pharmd_courses.xlsx:**

```
Level | Course Code | Course Title | Credit Hours | Has Oral Exam | Is Heavy | Must Be First
1     | PHAR101     | Chemistry I  | 3            | No            | No       | No
1     | PHAR102     | Pharmaceutics I | 4         | Yes           | Yes      | No
3     | PHAR301     | Pharmacology I | 3          | No            | No       | No
3     | PHAR302     | Therapeutics I | 4          | Yes           | Yes      | No
5     | PHAR501     | Clinical Pharmacy | 3       | No            | No       | No
```

### **Create pharmd_conflicts.xlsx:**

```
Course A | Course B | Overlap Count
PHAR101  | PHAR102  | 45
PHAR301  | PHAR302  | 38
PHAR101  | PHAR301  | 12
```

### **Create clinical_courses.xlsx:**

```
Level | Course Code | Course Title | Credit Hours | Has Oral Exam | Is Heavy | Must Be First
2     | CLIN201     | Clinical Skills I | 3 | No | No | No
4     | CLIN401     | Clinical Skills II | 3 | No | No | No
```

### **Create clinical_conflicts.xlsx:**

```
Course A | Course B | Overlap Count
CLIN201  | CLIN401  | 25
```

---

## 🧬 Advanced Optimization Features

The new scheduler uses:

### **1. Genetic Algorithm**
- Creates 50 different schedule variations
- Evolves them over 100 generations
- Keeps the best solutions (elitism)
- Combines good schedules (crossover)
- Introduces random changes (mutation)

### **2. Simulated Annealing**
- Fine-tunes the best schedule
- Escapes local optima
- Gradually reduces randomness
- Finds near-optimal solution

### **3. Intelligent Fitness Function**
Evaluates schedules based on:
- ❌ **Hard Constraints** (5000 penalty): No student has 2 exams same day
- ⚠️ **High Priority** (500-1000 penalty): Group A/B patterns, same level conflicts
- 📊 **Medium Priority** (200 penalty): Minimum gaps between conflicting courses
- 💡 **Preferences** (10-50 penalty): Heavy course spacing, early scheduling for "must be first"

---

## 📊 Understanding the Results

### **Fitness Score:**
- **0-50**: Excellent schedule, all constraints satisfied
- **50-200**: Good schedule, minor preference violations
- **200-500**: Acceptable schedule, some constraint violations
- **500+**: Poor schedule, major violations

### **Violations:**
- **UNSCHEDULED_COURSE**: Course couldn't be scheduled (period too short)
- **SAME_DAY_CONFLICT**: Students have 2 exams same day
- **INSUFFICIENT_GAP**: Not enough days between conflicting exams
- **GROUP_VIOLATION**: Level scheduled on wrong group day

---

## 🆘 Troubleshooting

### **"Generated Schedule (0 exams)"**
→ You haven't uploaded files yet. Upload Excel files first!

### **"Error uploading files"**
→ Check Excel file format matches the examples above

### **"Schedule has many violations"**
→ Your exam period might be too short for all courses
→ Try extending the end date

### **"Some courses unscheduled"**
→ Not enough days in the period
→ Too many conflicts making scheduling impossible
→ Extend the exam period

---

## ✅ Success Checklist

- [ ] Application running (http://localhost:3000)
- [ ] Session created with dates
- [ ] Excel files prepared with correct format
- [ ] Files uploaded successfully
- [ ] Schedule generated
- [ ] Results show scheduled exams
- [ ] Violations = 0 (or minimal)
- [ ] Schedule exported to markdown

---

## 🎯 Next Steps

1. **Prepare your Excel files** using the format above
2. **Upload them** through the web interface
3. **Click "Generate Schedule"**
4. **Wait 10-30 seconds** for optimization
5. **View your optimized schedule!**

---

## 💡 Pro Tips

1. **Start with a small test** (5-10 courses) to verify the format
2. **Ensure conflict data is accurate** - this is critical for optimization
3. **Allow enough days** - rule of thumb: (number of courses / 3) days minimum
4. **Use "Must Be First" sparingly** - only for truly critical courses
5. **Mark heavy courses correctly** - helps the algorithm space them out

---

**Ready to upload your files?** Go to the web interface and click "Upload Files"! 🚀

The advanced neural-inspired algorithm is ready to find your optimal schedule! 🧬

