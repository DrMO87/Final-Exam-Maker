-- ==========================================
-- SUPABASE POSTGRESQL DATABASE SCHEMA
-- Final Exam Maker - Exam Scheduler
-- Run this ENTIRE file in Supabase SQL Editor
-- ==========================================

-- Drop existing tables first (clean slate)
DROP TABLE IF EXISTS saved_schedules CASCADE;
DROP TABLE IF EXISTS conflicts CASCADE;
DROP TABLE IF EXISTS courses CASCADE;
DROP TABLE IF EXISTS scheduling_sessions CASCADE;

-- 1. Scheduling Sessions Table
CREATE TABLE scheduling_sessions (
    id SERIAL PRIMARY KEY,
    session_name VARCHAR(255) NOT NULL,
    semester VARCHAR(100) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Courses Table
CREATE TABLE courses (
    id SERIAL PRIMARY KEY,
    session_id INT REFERENCES scheduling_sessions(id) ON DELETE CASCADE,
    program VARCHAR(100) NOT NULL,
    level INT NOT NULL,
    course_code VARCHAR(50) NOT NULL,
    course_title VARCHAR(255) NOT NULL,
    has_oral_exam BOOLEAN DEFAULT FALSE,
    student_count INT DEFAULT 0,
    credit_hours INT DEFAULT 3,
    is_heavy BOOLEAN DEFAULT FALSE,
    must_be_first BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Conflicts Table
CREATE TABLE conflicts (
    id SERIAL PRIMARY KEY,
    session_id INT REFERENCES scheduling_sessions(id) ON DELETE CASCADE,
    course_a_id INT REFERENCES courses(id) ON DELETE CASCADE,
    course_b_id INT REFERENCES courses(id) ON DELETE CASCADE,
    overlap_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_conflict_pair UNIQUE(session_id, course_a_id, course_b_id)
);

-- 4. Saved Schedule Vault Table
CREATE TABLE saved_schedules (
    id SERIAL PRIMARY KEY,
    session_id INT REFERENCES scheduling_sessions(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    schedule_data JSONB NOT NULL,
    locked_assignments JSONB DEFAULT '{}'::jsonb,
    violation_count INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for fast queries
CREATE INDEX idx_courses_session ON courses(session_id);
CREATE INDEX idx_conflicts_session ON conflicts(session_id);
CREATE INDEX idx_saved_schedules_session ON saved_schedules(session_id);
