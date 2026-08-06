# Getting Started Checklist

Follow this checklist to get your PharmD Exam Scheduler up and running!

## ✅ Pre-Installation Checklist

- [ ] Node.js v16+ installed
  - Check: `node --version`
  - Download: https://nodejs.org/

- [ ] PostgreSQL v12+ installed
  - Check: `psql --version`
  - Download: https://www.postgresql.org/download/

- [ ] Git installed (optional, for version control)
  - Check: `git --version`

- [ ] Text editor/IDE installed (VS Code recommended)

## ✅ Installation Checklist

### Step 1: Dependencies

- [ ] Navigate to project directory
  ```bash
  cd "d:\HUE\DEVELOPED SOFTWARE\Final Exam Maker"
  ```

- [ ] Install backend dependencies
  ```bash
  cd backend
  npm install
  ```
  Expected: "added 143 packages"

- [ ] Install frontend dependencies
  ```bash
  cd ../frontend
  npm install
  ```
  Expected: "added 92 packages"

### Step 2: Database Setup

- [ ] Start PostgreSQL service
  - Windows: Check Services app
  - Mac: `brew services start postgresql`
  - Linux: `sudo systemctl start postgresql`

- [ ] Create database
  ```sql
  psql -U postgres
  CREATE DATABASE exam_scheduler;
  \q
  ```

- [ ] Verify database exists
  ```sql
  psql -U postgres -l
  ```
  Should see "exam_scheduler" in the list

### Step 3: Configuration

- [ ] Copy environment file
  ```bash
  cd backend
  copy .env.example .env
  ```

- [ ] Edit `backend/.env` with your settings
  - [ ] Set DB_PASSWORD to your PostgreSQL password
  - [ ] Verify DB_USER (usually "postgres")
  - [ ] Verify DB_HOST (usually "localhost")
  - [ ] Verify DB_PORT (usually 5432)
  - [ ] Verify DB_NAME (should be "exam_scheduler")

- [ ] Initialize database tables
  ```bash
  cd backend
  npm run init-db
  ```
  Expected: "✅ Database tables created successfully!"

## ✅ First Run Checklist

### Step 1: Start Backend

- [ ] Open terminal/command prompt
- [ ] Navigate to backend folder
  ```bash
  cd backend
  ```
- [ ] Start backend server
  ```bash
  npm run dev
  ```
- [ ] Verify backend is running
  - Should see: "🚀 Server is running on port 5000"
  - Should see: "Connected to PostgreSQL database"
- [ ] Test health endpoint
  - Open browser: http://localhost:5000/health
  - Should see: `{"status":"OK","message":"Exam Scheduler API is running"}`

### Step 2: Start Frontend

- [ ] Open NEW terminal/command prompt
- [ ] Navigate to frontend folder
  ```bash
  cd frontend
  ```
- [ ] Start frontend server
  ```bash
  npm run dev
  ```
- [ ] Verify frontend is running
  - Should see: "Local: http://localhost:3000/"
- [ ] Open application
  - Browser: http://localhost:3000
  - Should see: "PharmD Final Exam Scheduler" header

## ✅ First Use Checklist

### Prepare Your Data

- [ ] Read EXCEL_FORMAT_GUIDE.md
- [ ] Prepare PharmD courses Excel file
  - Required columns: Course Code, Course Title, Semester
  - Semester must contain "Level X" (1-5)
- [ ] Prepare PharmD Clinical courses Excel file
  - Same format as PharmD courses
- [ ] Prepare conflict matrices (optional)
  - Symmetric matrix format
  - Course names must match course files
- [ ] Prepare student numbers file (optional)

### Create First Session

- [ ] Open http://localhost:3000
- [ ] Fill in session form:
  - [ ] Session Name: "Fall 2025-2026 Final Exams"
  - [ ] Semester: "Fall 2025-2026"
  - [ ] Start Date: 2025-12-29
  - [ ] End Date: 2026-01-22
- [ ] Click "Create Session & Continue"
- [ ] Verify you moved to Step 2 (Upload Files)

### Upload Files

- [ ] Upload PharmD courses file
  - Click "Choose File" for PharmD Courses
  - Select your Excel file
  - Verify green checkmark appears
- [ ] Upload PharmD Clinical courses file
  - Click "Choose File" for PharmD Clinical Courses
  - Select your Excel file
  - Verify green checkmark appears
- [ ] Upload conflict matrices (optional)
- [ ] Upload student numbers (optional)
- [ ] Click "Upload & Process Files"
- [ ] Wait for success message
  - Should show: "Successfully processed X courses and Y conflicts"
- [ ] Verify you moved to Step 3 (Generate Schedule)

### Generate Schedule

- [ ] Click "Generate Schedule"
- [ ] Wait for processing (5-30 seconds)
- [ ] Review generated schedule
  - [ ] Check dates are within your exam period
  - [ ] Verify no Fridays have exams
  - [ ] Check Group A/B alternation
  - [ ] Review course distribution
- [ ] Check violations section
  - [ ] Review any warnings
  - [ ] Understand constraint conflicts
- [ ] Export schedule (optional)
  - [ ] Click "Export to Markdown"
  - [ ] Verify file downloads
  - [ ] Open file to verify format

## ✅ Verification Checklist

### Backend Verification

- [ ] Health endpoint responds
  ```bash
  curl http://localhost:5000/health
  ```

- [ ] Database connection works
  ```bash
  psql -U postgres -d exam_scheduler -c "SELECT COUNT(*) FROM scheduling_sessions;"
  ```

- [ ] Sessions API works
  ```bash
  curl http://localhost:5000/api/scheduler/sessions
  ```

### Frontend Verification

- [ ] Page loads without errors
- [ ] Step indicator shows correctly
- [ ] Forms are responsive
- [ ] File upload works
- [ ] Schedule displays properly
- [ ] Export button works

### Database Verification

- [ ] Tables exist
  ```sql
  psql -U postgres -d exam_scheduler
  \dt
  ```
  Should see: scheduling_sessions, courses, conflicts, schedules

- [ ] Data is stored
  ```sql
  SELECT * FROM scheduling_sessions;
  SELECT COUNT(*) FROM courses;
  SELECT COUNT(*) FROM conflicts;
  SELECT COUNT(*) FROM schedules;
  ```

## ✅ Troubleshooting Checklist

### Backend Won't Start

- [ ] Check PostgreSQL is running
- [ ] Verify .env file exists and has correct values
- [ ] Check port 5000 is not in use
- [ ] Review console for error messages
- [ ] Try: `npm install` again

### Frontend Won't Start

- [ ] Check backend is running first
- [ ] Verify port 3000 is not in use
- [ ] Review console for error messages
- [ ] Try: `npm install` again
- [ ] Clear browser cache

### Database Connection Fails

- [ ] Verify PostgreSQL service is running
- [ ] Check username/password in .env
- [ ] Verify database "exam_scheduler" exists
- [ ] Check firewall settings
- [ ] Try connecting with psql directly

### File Upload Fails

- [ ] Verify file is .xlsx or .xls format
- [ ] Check file size (should be < 10MB)
- [ ] Verify column names match expected format
- [ ] Check "Semester" column contains "Level X"
- [ ] Review browser console for errors

### Schedule Generation Fails

- [ ] Verify courses were uploaded successfully
- [ ] Check date range is sufficient (at least 15 days)
- [ ] Review violations section for details
- [ ] Check browser console for errors
- [ ] Verify backend logs for errors

## ✅ Next Steps Checklist

### Learn More

- [ ] Read README.md for full documentation
- [ ] Review PROMPT_IMPLEMENTATION.md for algorithm details
- [ ] Check PROJECT_STRUCTURE.md for architecture
- [ ] Study EXCEL_FORMAT_GUIDE.md for data preparation

### Customize

- [ ] Adjust constraint parameters in schedulerEngine.js
- [ ] Modify UI colors in App.css
- [ ] Add custom validation rules
- [ ] Extend database schema if needed

### Deploy

- [ ] Build frontend for production
  ```bash
  cd frontend
  npm run build
  ```
- [ ] Configure production database
- [ ] Set up reverse proxy (nginx)
- [ ] Enable HTTPS
- [ ] Set up monitoring

## ✅ Common Tasks Reference

### Restart Everything

```bash
# Stop both servers (Ctrl+C in each terminal)

# Restart backend
cd backend
npm run dev

# Restart frontend (new terminal)
cd frontend
npm run dev
```

### Reset Database

```bash
cd backend
npm run init-db
```
⚠️ Warning: This deletes all data!

### View Logs

- Backend: Check terminal where `npm run dev` is running
- Frontend: Check browser console (F12)
- Database: Check PostgreSQL logs

### Update Dependencies

```bash
# Backend
cd backend
npm update

# Frontend
cd frontend
npm update
```

## 🎉 Success Criteria

You're ready to use the application when:

✅ Backend server running on port 5000  
✅ Frontend server running on port 3000  
✅ Database connected and initialized  
✅ Can create a session  
✅ Can upload Excel files  
✅ Can generate a schedule  
✅ Can export to Markdown  

## 📚 Additional Resources

- **Documentation**: See all .md files in project root
- **Support**: Check QUICKSTART.md for common issues
- **Examples**: See EXCEL_FORMAT_GUIDE.md for sample data

## 🆘 Getting Help

If you're stuck:

1. Check the troubleshooting section above
2. Review error messages in console
3. Verify all checklist items are complete
4. Check documentation files
5. Review code comments in source files

---

**Ready?** Start with the Pre-Installation Checklist and work your way down! 🚀

