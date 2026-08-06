# PharmD Final Exam Scheduler

An intelligent exam scheduling application for Faculty of Pharmacy programs (PharmD and PharmD Clinical) with advanced conflict resolution and constraint satisfaction.

## 🎯 Features

- **Multi-Program Support**: Handles both PharmD and PharmD Clinical programs (Levels 1-5)
- **Conflict Resolution**: Automatically resolves student conflicts using conflict matrices
- **Smart Scheduling**: Implements complex constraints including:
  - Group A/B day alternation (odd/even levels)
  - Minimum gap requirements based on student overlap
  - Credit-hour-based spacing
  - Large course limits per day
  - Level-specific ordering requirements
  - Cross-program course alignment
- **Excel File Import**: Upload course lists, conflict matrices, and student numbers
- **Visual Schedule Display**: View generated schedules organized by date
- **Export to Markdown**: Download schedules in markdown table format

## 🏗️ Architecture

### Backend
- **Node.js + Express**: REST API server
- **PostgreSQL**: Relational database for courses, conflicts, and schedules
- **XLSX Parser**: Excel file processing
- **Custom Scheduling Engine**: Implements all constraints from the master prompt

### Frontend
- **React + Vite**: Modern, fast frontend framework
- **Axios**: HTTP client for API communication
- **Date-fns**: Date manipulation utilities
- **Responsive UI**: Clean, intuitive interface

## 📋 Prerequisites

- Node.js (v16 or higher)
- PostgreSQL (v12 or higher)
- npm or yarn package manager

## 🚀 Installation & Setup

### ⚡ Quick Start (Windows) - ONE COMMAND!

**First time setup? Just run this:**

```bash
.\complete-setup.bat
```

This single command will:
- ✅ Create the PostgreSQL database
- ✅ Initialize all database tables
- ✅ Start the backend server
- ✅ Start the frontend server
- ✅ Open the application in your browser

**📖 For detailed instructions, see [START_HERE.md](START_HERE.md)**

---

### Alternative: Manual Setup (Windows)

**For Windows users, we provide convenient batch files:**

1. **First-time setup:**
   ```bash
   install-dependencies.bat    # Install all dependencies
   init-database.bat          # Initialize database (after creating it)
   start-app.bat              # Start with full checks
   ```

2. **Daily use:**
   ```bash
   quick-start.bat            # Fast startup
   stop-app.bat               # Stop servers
   ```

📖 **See [BATCH_FILES_GUIDE.md](BATCH_FILES_GUIDE.md) for detailed batch file documentation**

---

### Manual Setup

### 1. Clone the Repository

```bash
cd "d:\HUE\DEVELOPED SOFTWARE\Final Exam Maker"
```

### 2. Set Up PostgreSQL Database

Create a new PostgreSQL database:

```sql
CREATE DATABASE exam_scheduler;
```

### 3. Configure Backend

```bash
cd backend
npm install
```

Edit the `.env` file with your database credentials:

```env
PORT=5000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=exam_scheduler
DB_USER=postgres
DB_PASSWORD=your_password_here
```

Initialize the database tables:

```bash
npm run init-db
```

### 4. Configure Frontend

```bash
cd ../frontend
npm install
```

## 🎮 Running the Application

### Start Backend Server

```bash
cd backend
npm run dev
```

The backend API will be available at `http://localhost:5000`

### Start Frontend Development Server

Open a new terminal:

```bash
cd frontend
npm run dev
```

The frontend will be available at `http://localhost:3000`

## 📊 Using the Application

### Step 1: Create a Scheduling Session

1. Enter a session name (e.g., "Fall 2025-2026 Final Exams")
2. Specify the semester
3. Set the exam period start date (e.g., 2025-12-29)
4. Set the exam period end date (e.g., 2026-01-22)
5. Click "Create Session & Continue"

### Step 2: Upload Excel Files

Upload the following Excel files:

1. **PharmD Courses** (Required)
   - Columns: Course Code, Course Title, Semester, Has Oral Exam, Student Count, Credit Hours

2. **PharmD Clinical Courses** (Required)
   - Same structure as PharmD courses

3. **PharmD Conflict Matrix** (Optional)
   - Symmetric matrix showing student overlap between courses

4. **PharmD Clinical Conflict Matrix** (Optional)
   - Same structure as PharmD conflict matrix

5. **Student Numbers** (Optional)
   - Additional student count data

### Step 3: Generate Schedule

1. Click "Generate Schedule"
2. Wait for the algorithm to process (may take a few moments)
3. Review the generated schedule organized by date
4. Check for any violations or warnings
5. Export to Markdown if needed

## 📁 Excel File Format

### Course File Format

| Course Code | Course Title | Semester | Has Oral Exam | Student Count | Credit Hours | Is Heavy | Must Be First |
|-------------|--------------|----------|---------------|---------------|--------------|----------|---------------|
| PHAR101 | Pharmaceutical Chemistry | Level 1; Semester 1 | Yes | 150 | 3 | Yes | No |

### Conflict Matrix Format

|  | Course A | Course B | Course C |
|--|----------|----------|----------|
| Course A | - | 25 | 10 |
| Course B | 25 | - | 5 |
| Course C | 10 | 5 | - |

## 🔧 Scheduling Constraints

The application implements the following constraints from the master prompt:

### Hard Constraints (Never Violated)
- Fridays are off (no exams)
- Group A days (Levels 1, 3, 5) and Group B days (Levels 2, 4) alternate
- No student has two exams on the same day
- Conflicting courses cannot be on the same day
- Specific courses must be first for their level

### High Priority Constraints
- Minimum gaps based on student overlap (1-4 days)
- Credit-hour-based gaps
- Maximum 3 large courses per day
- Level-specific course ordering
- Heavy vs. light course alternation for Level 1

### Preferences
- Cross-program course alignment
- High-conflict courses at period edges
- Minimize idle days
- Fair distribution of heavy exams

## 🛠️ API Endpoints

- `POST /api/scheduler/session` - Create new scheduling session
- `POST /api/scheduler/upload` - Upload and process Excel files
- `POST /api/scheduler/generate/:sessionId` - Generate schedule
- `GET /api/scheduler/schedule/:sessionId` - Get generated schedule
- `GET /api/scheduler/sessions` - List all sessions
- `GET /health` - Health check

## 📝 Database Schema

### Tables
- `scheduling_sessions` - Exam scheduling sessions
- `courses` - Course information
- `conflicts` - Student conflict data
- `schedules` - Generated exam schedules

## 🐛 Troubleshooting

### Database Connection Issues
- Verify PostgreSQL is running
- Check database credentials in `.env`
- Ensure database exists

### File Upload Errors
- Verify Excel file format matches expected structure
- Check file size limits
- Ensure all required columns are present

### Schedule Generation Issues
- Review uploaded data for completeness
- Check violations section for constraint conflicts
- Verify date range is sufficient

## 📄 License

MIT License

## 👥 Support

For issues or questions, please check the violations section in the generated schedule for detailed constraint information.

