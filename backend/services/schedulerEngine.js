import { addDays, format, isAfter, isBefore, differenceInDays, parseISO } from 'date-fns';

class SchedulerEngine {
  constructor(courses, conflicts, startDate, endDate) {
    this.courses = courses;
    this.conflicts = conflicts;
    this.startDate = parseISO(startDate);
    this.endDate = parseISO(endDate);
    this.schedule = [];
    this.violations = [];
    this.conflictMap = this.buildConflictMap();
  }

  buildConflictMap() {
    const map = new Map();
    
    this.conflicts.forEach(conflict => {
      const key1 = `${conflict.course_a_id}`;
      const key2 = `${conflict.course_b_id}`;
      
      if (!map.has(key1)) map.set(key1, new Map());
      if (!map.has(key2)) map.set(key2, new Map());
      
      map.get(key1).set(key2, conflict.overlap_count);
      map.get(key2).set(key1, conflict.overlap_count);
    });
    
    return map;
  }

  getConflictCount(courseAId, courseBId) {
    const courseAConflicts = this.conflictMap.get(String(courseAId));
    if (!courseAConflicts) return 0;
    return courseAConflicts.get(String(courseBId)) || 0;
  }

  generateCalendar() {
    const calendar = [];
    let currentDate = this.startDate;
    let isGroupA = true; // Start with Group A (Levels 1, 3, 5)

    while (!isAfter(currentDate, this.endDate)) {
      const dayOfWeek = format(currentDate, 'EEEE');
      
      // Skip Fridays
      if (dayOfWeek !== 'Friday') {
        calendar.push({
          date: currentDate,
          dateStr: format(currentDate, 'yyyy-MM-dd'),
          dayOfWeek,
          groupType: isGroupA ? 'A' : 'B',
          allowedLevels: isGroupA ? [1, 3, 5] : [2, 4],
          scheduledCourses: []
        });
        isGroupA = !isGroupA; // Alternate groups on non-Friday days
      }
      
      currentDate = addDays(currentDate, 1);
    }
    
    return calendar;
  }

  getMinimumGap(courseA, courseB, overlapCount) {
    let gap = 0;
    
    // Base conflict rule
    if (overlapCount > 0) gap = Math.max(gap, 1);
    if (overlapCount >= 10) gap = Math.max(gap, 2);
    if (overlapCount > 50) gap = Math.max(gap, 4);
    
    // Credit hour based gaps
    const maxCredits = Math.max(courseA.credit_hours || 3, courseB.credit_hours || 3);
    gap = Math.max(gap, maxCredits);
    
    return gap;
  }

  canScheduleCourse(course, day, calendar, allowGroupOverride = false) {
    // Check if level is allowed on this day (can be overridden for common course alignment)
    if (!allowGroupOverride && !day.allowedLevels.includes(course.level)) {
      return { canSchedule: false, reason: 'Level not allowed on this day (Group A/B rule)' };
    }

    // Check if same level already has exam on this day
    const sameLevelExam = day.scheduledCourses.find(
      c => c.program === course.program && c.level === course.level
    );
    if (sameLevelExam) {
      return { canSchedule: false, reason: 'Same level already has exam on this day' };
    }

    // Check conflicts with courses on the same day
    for (const scheduledCourse of day.scheduledCourses) {
      const overlapCount = this.getConflictCount(course.id, scheduledCourse.id);
      if (overlapCount > 0) {
        return { canSchedule: false, reason: `Conflict with ${scheduledCourse.course_title} (${overlapCount} students)` };
      }
    }

    // Check minimum gaps with all scheduled courses
    const courseIndex = calendar.findIndex(d => d.dateStr === day.dateStr);

    for (let i = 0; i < calendar.length; i++) {
      const otherDay = calendar[i];

      for (const scheduledCourse of otherDay.scheduledCourses) {
        const overlapCount = this.getConflictCount(course.id, scheduledCourse.id);

        if (overlapCount > 0) {
          const requiredGap = this.getMinimumGap(course, scheduledCourse, overlapCount);
          const actualGap = Math.abs(i - courseIndex) - 1; // Full days between

          if (actualGap < requiredGap) {
            return {
              canSchedule: false,
              reason: `Insufficient gap with ${scheduledCourse.course_title} (need ${requiredGap} days, have ${actualGap})`
            };
          }
        }
      }
    }

    // Check large course limit (max 3 large courses per day)
    const largeCourses = day.scheduledCourses.filter(c => {
      // A course is "large" if it has any conflict with >10 students
      const courseConflicts = this.conflictMap.get(String(c.id));
      if (!courseConflicts) return false;
      return Array.from(courseConflicts.values()).some(count => count > 10);
    });

    const isLargeCourse = this.conflictMap.get(String(course.id)) &&
      Array.from(this.conflictMap.get(String(course.id)).values()).some(count => count > 10);

    if (isLargeCourse && largeCourses.length >= 3) {
      return { canSchedule: false, reason: 'Maximum large courses per day reached (3)' };
    }

    return { canSchedule: true };
  }

  getTotalConflictWeight(course) {
    const courseConflicts = this.conflictMap.get(String(course.id));
    if (!courseConflicts) return 0;
    return Array.from(courseConflicts.values()).reduce((sum, count) => sum + count, 0);
  }

  scheduleMustBeFirstCourses(calendar) {
    // Handle special "must be first" constraints
    const mustBeFirstCourses = this.courses.filter(c => c.must_be_first);

    for (const course of mustBeFirstCourses) {
      let scheduled = false;

      // Find the first available day for this level
      for (const day of calendar) {
        if (!day.allowedLevels.includes(course.level)) continue;

        // Check if this level already has a course scheduled
        const levelHasCourse = day.scheduledCourses.some(
          c => c.program === course.program && c.level === course.level
        );

        if (!levelHasCourse) {
          const result = this.canScheduleCourse(course, day, calendar);
          if (result.canSchedule) {
            day.scheduledCourses.push(course);
            this.schedule.push({
              course_id: course.id,
              exam_date: day.dateStr,
              day_of_week: day.dayOfWeek,
              group_type: day.groupType,
              course: course
            });
            scheduled = true;
            break;
          }
        }
      }

      if (!scheduled) {
        this.violations.push({
          type: 'MUST_BE_FIRST_NOT_SCHEDULED',
          course: course.course_title,
          program: course.program,
          level: course.level
        });
      }
    }
  }

  findCommonCourses() {
    // Find courses with same or similar names across programs
    const commonCourses = new Map();

    this.courses.forEach(course => {
      const key = course.course_title.toLowerCase().trim();
      if (!commonCourses.has(key)) {
        commonCourses.set(key, []);
      }
      commonCourses.get(key).push(course);
    });

    // Filter to only courses that appear in multiple programs
    const result = [];
    commonCourses.forEach((courses, title) => {
      if (courses.length > 1) {
        result.push(courses);
      }
    });

    return result;
  }

  alignCommonCourses(calendar) {
    const commonCourseGroups = this.findCommonCourses();

    for (const group of commonCourseGroups) {
      // Try to find a day that works for all courses in the group
      let bestDay = null;

      for (const day of calendar) {
        let allCanSchedule = true;

        for (const course of group) {
          // Skip if already scheduled
          if (this.schedule.find(s => s.course_id === course.id)) {
            allCanSchedule = false;
            break;
          }

          const result = this.canScheduleCourse(course, day, calendar, true);
          if (!result.canSchedule) {
            allCanSchedule = false;
            break;
          }
        }

        if (allCanSchedule) {
          bestDay = day;
          break;
        }
      }

      // Schedule all courses in the group on the same day
      if (bestDay) {
        for (const course of group) {
          if (!this.schedule.find(s => s.course_id === course.id)) {
            bestDay.scheduledCourses.push(course);
            this.schedule.push({
              course_id: course.id,
              exam_date: bestDay.dateStr,
              day_of_week: bestDay.dayOfWeek,
              group_type: bestDay.groupType,
              course: course
            });
          }
        }
      }
    }
  }

  generateSchedule() {
    const calendar = this.generateCalendar();

    // Step 1: Schedule "must be first" courses
    this.scheduleMustBeFirstCourses(calendar);

    // Step 2: Try to align common courses across programs
    this.alignCommonCourses(calendar);

    // Step 3: Get remaining unscheduled courses
    const scheduledIds = new Set(this.schedule.map(s => s.course_id));
    const unscheduledCourses = this.courses.filter(c => !scheduledIds.has(c.id));

    // Sort remaining courses by priority
    unscheduledCourses.sort((a, b) => {
      // First: by level (higher levels first to give them more flexibility)
      if (a.level !== b.level) return b.level - a.level;

      // Then: by conflict weight (higher conflict courses first)
      const weightA = this.getTotalConflictWeight(a);
      const weightB = this.getTotalConflictWeight(b);
      return weightB - weightA;
    });

    // Step 4: Schedule remaining courses
    for (const course of unscheduledCourses) {
      let scheduled = false;

      for (const day of calendar) {
        const result = this.canScheduleCourse(course, day, calendar);

        if (result.canSchedule) {
          day.scheduledCourses.push(course);
          this.schedule.push({
            course_id: course.id,
            exam_date: day.dateStr,
            day_of_week: day.dayOfWeek,
            group_type: day.groupType,
            course: course
          });
          scheduled = true;
          break;
        }
      }

      if (!scheduled) {
        this.violations.push({
          type: 'UNSCHEDULED_COURSE',
          course: course.course_title,
          program: course.program,
          level: course.level
        });
      }
    }

    return {
      schedule: this.schedule,
      calendar: calendar,
      violations: this.violations
    };
  }
}

export default SchedulerEngine;

