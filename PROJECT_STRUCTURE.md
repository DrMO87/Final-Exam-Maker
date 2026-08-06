# Project Structure

Complete overview of the PharmD Exam Scheduler application structure.

## Directory Tree

```
Final Exam Maker/
├── backend/                          # Backend API server
│   ├── config/
│   │   └── database.js              # PostgreSQL connection configuration
│   ├── routes/
│   │   └── scheduler.js             # API routes for scheduling operations
│   ├── services/
│   │   ├── schedulerEngine.js       # Core scheduling algorithm
│   │   └── excelParser.js           # Excel file parsing logic
│   ├── scripts/
│   │   └── initDatabase.js          # Database initialization script
│   ├── uploads/                     # Temporary file upload directory (auto-created)
│   ├── .env                         # Environment variables (not in git)
│   ├── .env.example                 # Environment variables template
│   ├── package.json                 # Backend dependencies
│   └── server.js                    # Express server entry point
│
├── frontend/                         # React frontend application
│   ├── src/
│   │   ├── components/
│   │   │   ├── SessionForm.jsx      # Create scheduling session form
│   │   │   ├── FileUpload.jsx       # Excel file upload component
│   │   │   └── ScheduleViewer.jsx   # Schedule display and export
│   │   ├── App.jsx                  # Main application component
│   │   ├── App.css                  # Application styles
│   │   ├── main.jsx                 # React entry point
│   │   └── index.css                # Global styles
│   ├── index.html                   # HTML template
│   ├── vite.config.js               # Vite configuration
│   └── package.json                 # Frontend dependencies
│
├── .gitignore                        # Git ignore rules
├── README.md                         # Main documentation
├── QUICKSTART.md                     # Quick start guide
├── EXCEL_FORMAT_GUIDE.md            # Excel file format specifications
├── PROMPT_IMPLEMENTATION.md         # Master prompt implementation details
├── PROJECT_STRUCTURE.md             # This file
└── setup.ps1                        # Windows setup script
```

## Backend Architecture

### Server Layer (`server.js`)
- Express.js application
- CORS middleware for cross-origin requests
- JSON body parsing
- Route mounting
- Error handling middleware

### Routes Layer (`routes/scheduler.js`)
- **POST /api/scheduler/session** - Create new scheduling session
- **POST /api/scheduler/upload** - Upload and process Excel files
- **POST /api/scheduler/generate/:sessionId** - Generate exam schedule
- **GET /api/scheduler/schedule/:sessionId** - Retrieve generated schedule
- **GET /api/scheduler/sessions** - List all sessions
- **GET /health** - Health check endpoint

### Services Layer

#### `schedulerEngine.js` - Core Scheduling Logic
**Classes:**
- `SchedulerEngine` - Main scheduling algorithm

**Key Methods:**
- `generateCalendar()` - Creates calendar with Group A/B days
- `buildConflictMap()` - Builds course conflict lookup
- `getMinimumGap()` - Calculates required gap between courses
- `canScheduleCourse()` - Validates course placement
- `scheduleMustBeFirstCourses()` - Handles priority courses
- `findCommonCourses()` - Identifies cross-program courses
- `alignCommonCourses()` - Aligns common courses
- `generateSchedule()` - Main scheduling algorithm

**Algorithm Flow:**
1. Generate calendar (skip Fridays, alternate groups)
2. Build conflict map from database
3. Schedule "must be first" courses
4. Align common courses across programs
5. Schedule remaining courses by priority
6. Track violations

#### `excelParser.js` - File Processing
**Methods:**
- `parseCourseFile()` - Parse course list Excel files
- `parseConflictMatrix()` - Parse conflict matrix Excel files
- `parseStudentNumbers()` - Parse student count Excel files
- `parseBoolean()` - Helper for boolean value parsing

### Database Layer (`config/database.js`)
- PostgreSQL connection pool
- Connection error handling
- Query interface

### Database Schema

#### `scheduling_sessions`
```sql
id              SERIAL PRIMARY KEY
session_name    VARCHAR(255)
semester        VARCHAR(100)
start_date      DATE
end_date        DATE
created_at      TIMESTAMP
updated_at      TIMESTAMP
```

#### `courses`
```sql
id              SERIAL PRIMARY KEY
session_id      INTEGER (FK)
program         VARCHAR(50)      -- 'PharmD' or 'PharmD Clinical'
level           INTEGER          -- 1-5
course_code     VARCHAR(50)
course_title    VARCHAR(255)
has_oral_exam   BOOLEAN
student_count   INTEGER
credit_hours    INTEGER
is_heavy        BOOLEAN
must_be_first   BOOLEAN
created_at      TIMESTAMP
```

#### `conflicts`
```sql
id              SERIAL PRIMARY KEY
session_id      INTEGER (FK)
course_a_id     INTEGER (FK)
course_b_id     INTEGER (FK)
overlap_count   INTEGER          -- Number of students in both courses
created_at      TIMESTAMP
```

#### `schedules`
```sql
id              SERIAL PRIMARY KEY
session_id      INTEGER (FK)
course_id       INTEGER (FK)
exam_date       DATE
day_of_week     VARCHAR(20)
group_type      VARCHAR(10)      -- 'A' or 'B'
created_at      TIMESTAMP
```

## Frontend Architecture

### Component Hierarchy

```
App
├── SessionForm          (Step 1: Create session)
├── FileUpload          (Step 2: Upload files)
└── ScheduleViewer      (Step 3: Generate & view)
```

### Component Details

#### `App.jsx`
- Main application container
- Step navigation (1→2→3)
- State management for session and schedule
- Step indicator UI

#### `SessionForm.jsx`
- Form for creating scheduling session
- Inputs: session name, semester, date range
- API call to create session
- Error handling

#### `FileUpload.jsx`
- Multi-file upload interface
- File validation (.xlsx, .xls only)
- FormData construction
- Upload progress and feedback
- API call to process files

#### `ScheduleViewer.jsx`
- Schedule generation trigger
- Schedule display grouped by date
- Markdown export functionality
- Violations display
- API calls for schedule generation and retrieval

### Styling
- `App.css` - Component-specific styles
- `index.css` - Global styles and resets
- Gradient theme (purple/blue)
- Responsive design
- Clean, modern UI

### State Management
- React useState hooks
- Props drilling for data flow
- No external state management (Redux, etc.)

## Data Flow

### 1. Session Creation
```
User Input → SessionForm → POST /api/scheduler/session → Database
→ Session ID → App State → FileUpload
```

### 2. File Upload
```
Excel Files → FileUpload → FormData → POST /api/scheduler/upload
→ ExcelParser → Database (courses, conflicts) → Success → ScheduleViewer
```

### 3. Schedule Generation
```
ScheduleViewer → POST /api/scheduler/generate/:sessionId
→ Database (fetch courses, conflicts)
→ SchedulerEngine.generateSchedule()
→ Database (save schedule)
→ Response (schedule, violations)
→ ScheduleViewer Display
```

### 4. Schedule Export
```
ScheduleViewer → Format as Markdown → Browser Download
```

## Configuration Files

### `backend/.env`
```env
PORT=5000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=exam_scheduler
DB_USER=postgres
DB_PASSWORD=your_password
```

### `frontend/vite.config.js`
```javascript
{
  server: { port: 3000 },
  proxy: { '/api': 'http://localhost:5000' }
}
```

## Dependencies

### Backend
- **express** - Web framework
- **cors** - Cross-origin resource sharing
- **dotenv** - Environment variables
- **pg** - PostgreSQL client
- **multer** - File upload handling
- **xlsx** - Excel file parsing
- **date-fns** - Date manipulation

### Frontend
- **react** - UI library
- **react-dom** - React DOM rendering
- **axios** - HTTP client
- **date-fns** - Date formatting
- **vite** - Build tool and dev server

## Build & Deployment

### Development
```bash
# Backend
cd backend && npm run dev

# Frontend
cd frontend && npm run dev
```

### Production Build
```bash
# Frontend
cd frontend && npm run build
# Output: frontend/dist/

# Backend (no build needed, runs directly)
cd backend && npm start
```

### Environment Variables
- Development: `.env` files
- Production: System environment variables or secrets management

## Testing Strategy

### Backend Testing
- Unit tests for schedulerEngine methods
- Integration tests for API endpoints
- Database transaction tests

### Frontend Testing
- Component unit tests (React Testing Library)
- Integration tests for user flows
- E2E tests (Playwright/Cypress)

### Test Data
- Sample Excel files with known conflicts
- Edge cases (minimal period, maximum conflicts)
- Validation tests for constraint satisfaction

## Security Considerations

### Backend
- Input validation on all endpoints
- File type validation (Excel only)
- SQL injection prevention (parameterized queries)
- File size limits
- CORS configuration

### Frontend
- XSS prevention (React auto-escaping)
- CSRF protection (if adding authentication)
- Secure file upload handling

### Database
- Connection pooling
- Prepared statements
- Access control (user permissions)

## Performance Optimization

### Backend
- Database indexing on frequently queried columns
- Connection pooling
- Efficient conflict map (O(1) lookups)
- Streaming large file uploads

### Frontend
- Code splitting (Vite automatic)
- Lazy loading components
- Memoization for expensive computations
- Debouncing user inputs

### Algorithm
- Greedy scheduling (O(C×D×C))
- Early constraint checking
- Conflict map caching
- Sorted course prioritization

## Monitoring & Logging

### Backend Logging
```javascript
console.log('Scheduling course:', course.course_title);
console.error('Error generating schedule:', error);
```

### Frontend Logging
```javascript
console.log('Session created:', sessionId);
console.error('Upload failed:', error);
```

### Production Monitoring
- Error tracking (Sentry, etc.)
- Performance monitoring (New Relic, etc.)
- Database query monitoring
- API response times

## Extensibility

### Adding New Constraints
1. Add constraint logic to `schedulerEngine.js`
2. Update `canScheduleCourse()` method
3. Add violation tracking
4. Document in PROMPT_IMPLEMENTATION.md

### Adding New Features
1. Backend: Add route in `routes/scheduler.js`
2. Frontend: Create component in `src/components/`
3. Update API documentation
4. Add tests

### Database Migrations
1. Create migration script in `backend/scripts/`
2. Version control schema changes
3. Update `initDatabase.js`

## Troubleshooting Guide

See QUICKSTART.md for common issues and solutions.

## Contributing

1. Fork the repository
2. Create feature branch
3. Make changes
4. Test thoroughly
5. Submit pull request

## License

MIT License - See LICENSE file for details.

