import { addDays, format, parseISO, differenceInDays } from 'date-fns';

/**
 * Advanced Exam Scheduler using Genetic Algorithm + Simulated Annealing
 * Implements the PharmD Master Prompt constraints with optimization
 */
class AdvancedScheduler {
  constructor(courses, conflicts, startDate, endDate, lockedAssignments = {}) {
    this.courses = courses;
    this.conflicts = conflicts;
    this.startDate = parseISO(startDate);
    this.endDate = parseISO(endDate);
    
    // Fallback if parseISO fails (e.g. invalid format in DB)
    if (isNaN(this.startDate.getTime())) this.startDate = new Date(startDate);
    if (isNaN(this.endDate.getTime())) this.endDate = new Date(endDate);

    this.lockedAssignments = lockedAssignments;
    this.conflictMap = this.buildConflictMap();
    this.calendar = this.generateCalendar();

    if (this.calendar.length === 0) {
      throw new Error(`Calendar generation failed: 0 valid days found between ${startDate} and ${endDate}. Please check the session dates.`);
    }
    
    // Genetic Algorithm parameters
    this.populationSize = 50;
    this.generations = 100;
    this.mutationRate = 0.15;
    this.eliteSize = 5;
    
    // Simulated Annealing parameters
    this.initialTemp = 1000;
    this.coolingRate = 0.95;
    this.minTemp = 1;
  }

  buildConflictMap() {
    const map = new Map();
    this.conflicts.forEach(conflict => {
      const key1 = String(conflict.course_a_id);
      const key2 = String(conflict.course_b_id);
      
      if (!map.has(key1)) map.set(key1, new Map());
      if (!map.has(key2)) map.set(key2, new Map());
      
      map.get(key1).set(key2, conflict.overlap_count);
      map.get(key2).set(key1, conflict.overlap_count);
    });
    return map;
  }

  generateCalendar() {
    const calendar = [];
    let currentDate = this.startDate;
    let isGroupA = true;
    let dayIndex = 0;

    while (currentDate <= this.endDate) {
      const dayOfWeek = format(currentDate, 'EEEE');
      
      if (dayOfWeek !== 'Friday') {
        calendar.push({
          index: dayIndex++,
          date: currentDate,
          dateStr: format(currentDate, 'yyyy-MM-dd'),
          dayOfWeek,
          groupType: isGroupA ? 'A' : 'B',
          allowedLevels: isGroupA ? [1, 3, 5] : [2, 4]
        });
        isGroupA = !isGroupA;
      }
      currentDate = addDays(currentDate, 1);
    }
    return calendar;
  }

  getConflictCount(courseAId, courseBId) {
    const conflicts = this.conflictMap.get(String(courseAId));
    return conflicts?.get(String(courseBId)) || 0;
  }

  getMinimumGap(courseA, courseB, overlapCount) {
    let gap = 0;
    
    if (overlapCount > 0) gap = Math.max(gap, 1);
    if (overlapCount >= 10) gap = Math.max(gap, 2);
    if (overlapCount >= 50) gap = Math.max(gap, 3); // Updated to 3 days gap
    
    const maxCredits = Math.max(courseA.credit_hours || 3, courseB.credit_hours || 3);
    gap = Math.max(gap, maxCredits);
    
    return gap;
  }

  /**
   * Fitness function - lower is better
   * Evaluates schedule quality based on all constraints
   */
  calculateFitness(schedule) {
    let penalty = 0;
    const periodAssignments = new Map(); // Key: `${dayIndex}-${period}`

    // Build period assignments
    schedule.forEach((assignment, courseIdx) => {
      if (!assignment || assignment.dayIndex === undefined || assignment.dayIndex === null || assignment.dayIndex === -1) {
        penalty += 10000; // Unscheduled course - huge penalty
        return;
      }

      const key = `${assignment.dayIndex}-${assignment.period}`;
      if (!periodAssignments.has(key)) {
        periodAssignments.set(key, []);
      }
      periodAssignments.get(key).push({
        course: this.courses[courseIdx],
        courseIdx
      });
      
      // Oral Exam constraint (MUST be period 1)
      if (this.courses[courseIdx].has_oral_exam && assignment.period !== 1) {
        penalty += 5000; // Hard constraint violation
      }
    });

    // Check capacity constraint per period
    periodAssignments.forEach((coursesInPeriod) => {
      const totalStudents = coursesInPeriod.reduce((sum, item) => sum + (item.course.student_count || 0), 0);
      if (totalStudents > 1000) {
        penalty += 5000 * Math.ceil((totalStudents - 1000) / 100); // Massive penalty for exceeding capacity
      }
    });

    // Check day constraints (iterating through days)
    for (let dayIndex = 0; dayIndex < this.calendar.length; dayIndex++) {
      const p1Key = `${dayIndex}-1`;
      const p2Key = `${dayIndex}-2`;
      const coursesP1 = periodAssignments.get(p1Key) || [];
      const coursesP2 = periodAssignments.get(p2Key) || [];
      const coursesOnDay = [...coursesP1, ...coursesP2];
      
      const day = this.calendar[dayIndex];

      // Check conflicts on the same day
      for (let i = 0; i < coursesOnDay.length; i++) {
        for (let j = i + 1; j < coursesOnDay.length; j++) {
          const overlap = this.getConflictCount(
            coursesOnDay[i].course.id,
            coursesOnDay[j].course.id
          );
          
          if (overlap > 0) {
            const samePeriod = coursesOnDay[i].courseIdx !== undefined && coursesP1.includes(coursesOnDay[i]) === coursesP1.includes(coursesOnDay[j]);
            
            if (samePeriod) {
              // Same day, Same period -> HARD PENALTY ALWAYS
              penalty += 5000 * overlap;
            } else {
              // Same day, Different period
              if (overlap >= 5) {
                // >= 5 overlap -> HARD PENALTY (Cannot be on same day)
                penalty += 5000 * overlap;
              } else {
                // 1 to 4 overlap -> Allowed, but add a very tiny preference penalty if desired
                penalty += 10 * overlap;
              }
            }
          }
        }
      }

      // HIGH PRIORITY: Group A/B day pattern
      coursesOnDay.forEach(({ course }) => {
        if (!day.allowedLevels.includes(course.level)) {
          penalty += 500; // Can be violated for common courses
        }
      });
      
      // HIGH PRIORITY: Same level, same program, same day
      const levelProgramMap = new Map();
      coursesOnDay.forEach(({ course }) => {
        const key = `${course.program}-${course.level}`;
        if (levelProgramMap.has(key)) {
          penalty += 1000; // Multiple exams for same level/program
        }
        levelProgramMap.set(key, true);
      });
    }

    // Check minimum gaps between conflicting courses
    schedule.forEach((assignment1, idx1) => {
      if (!assignment1 || typeof assignment1.dayIndex !== 'number' || assignment1.dayIndex < 0 || assignment1.dayIndex >= this.calendar.length) return;

      schedule.forEach((assignment2, idx2) => {
        if (idx1 >= idx2 || !assignment2 || typeof assignment2.dayIndex !== 'number' || assignment2.dayIndex < 0 || assignment2.dayIndex >= this.calendar.length) return;

        const course1 = this.courses[idx1];
        const course2 = this.courses[idx2];
        const overlap = this.getConflictCount(course1.id, course2.id);

        if (overlap > 0) {
          const requiredGap = this.getMinimumGap(course1, course2, overlap);
          // Calculate gap based on absolute calendar days difference
          const date1 = this.calendar[assignment1.dayIndex].date;
          const date2 = this.calendar[assignment2.dayIndex].date;
          const actualGap = Math.abs(differenceInDays(date1, date2)) - 1;

          if (actualGap < requiredGap) {
            penalty += 200 * (requiredGap - actualGap); // Gap violation
          }
        }
      });
    });

    // PREFERENCE: Heavy courses should have more gap
    schedule.forEach((assignment, idx) => {
      if (!assignment || assignment.dayIndex === undefined) return;

      const course = this.courses[idx];
      if (course.is_heavy && assignment.dayIndex > 0) {
        const prevDayHasCourses = schedule.some((a, i) =>
          i !== idx && a && a.dayIndex === assignment.dayIndex - 1
        );
        if (prevDayHasCourses) {
          penalty += 50; // Prefer gap before heavy courses
        }
      }
    });

    // RULE: Same course title/code across different programs MUST be on the SAME DAY
    schedule.forEach((assignment1, idx1) => {
      if (!assignment1 || typeof assignment1.dayIndex !== 'number' || assignment1.dayIndex < 0 || assignment1.dayIndex >= this.calendar.length) return;

      schedule.forEach((assignment2, idx2) => {
        if (idx1 >= idx2 || !assignment2 || typeof assignment2.dayIndex !== 'number' || assignment2.dayIndex < 0 || assignment2.dayIndex >= this.calendar.length) return;

        const course1 = this.courses[idx1];
        const course2 = this.courses[idx2];

        if (course1.program !== course2.program) {
          const title1 = course1.course_title.trim().toLowerCase();
          const title2 = course2.course_title.trim().toLowerCase();
          const code1 = course1.course_code.trim().toLowerCase();
          const code2 = course2.course_code.trim().toLowerCase();

          if (title1 === title2 || code1 === code2) {
            if (assignment1.dayIndex !== assignment2.dayIndex) {
              penalty += 2000; // Strong penalty if same course across programs is on different days
            }
          }
        }
      });
    });

    // PREFERENCE: Must be first courses should be early
    schedule.forEach((assignment, idx) => {
      if (!assignment || assignment.dayIndex === undefined) return;

      const course = this.courses[idx];
      if (course.must_be_first) {
        penalty += assignment.dayIndex * 10; // Prefer earlier days
      }
    });

    return penalty;
  }

  /**
   * Create initial population with greedy heuristics
   */
  createInitialPopulation() {
    const population = [];

    for (let p = 0; p < this.populationSize; p++) {
      // Initialize schedule with all courses
      const schedule = new Array(this.courses.length);

      // Initialize all positions
      for (let i = 0; i < this.courses.length; i++) {
        const courseId = String(this.courses[i].id);
        if (this.lockedAssignments[courseId]) {
          schedule[i] = { 
            dayIndex: this.lockedAssignments[courseId].dayIndex, 
            period: this.lockedAssignments[courseId].period,
            isLocked: true 
          };
        } else {
          schedule[i] = { dayIndex: -1, period: 1, isLocked: false };
        }
      }

      // Shuffle courses for diversity
      const shuffledCourses = [...this.courses]
        .map((course, idx) => ({ course, idx }))
        .sort(() => Math.random() - 0.5);

      shuffledCourses.forEach(({ course, idx }) => {
        if (schedule[idx].isLocked) return;

        let bestDay = -1;
        let bestPeriod = 1;
        let bestPenalty = Infinity;

        // Try each day and period
        for (let dayIdx = 0; dayIdx < this.calendar.length; dayIdx++) {
          const day = this.calendar[dayIdx];

          // Quick feasibility check
          if (!day.allowedLevels.includes(course.level) && Math.random() > 0.3) {
            continue; // Usually respect group pattern
          }

          for (let period = 1; period <= 2; period++) {
            // Tentatively assign
            schedule[idx] = { dayIndex: dayIdx, period, isLocked: false };
            const penalty = this.calculateFitness(schedule);

            if (penalty < bestPenalty) {
              bestPenalty = penalty;
              bestDay = dayIdx;
              bestPeriod = period;
            }
          }
        }

        schedule[idx] = { dayIndex: bestDay, period: bestPeriod, isLocked: false };
      });

      population.push({
        schedule,
        fitness: this.calculateFitness(schedule)
      });
    }

    return population.sort((a, b) => a.fitness - b.fitness);
  }

  /**
   * Tournament selection
   */
  selectParent(population) {
    const tournamentSize = 5;
    let best = population[Math.floor(Math.random() * population.length)];
    
    for (let i = 1; i < tournamentSize; i++) {
      const competitor = population[Math.floor(Math.random() * population.length)];
      if (competitor.fitness < best.fitness) {
        best = competitor;
      }
    }
    
    return best;
  }

  /**
   * Crossover - combine two parent schedules
   */
  crossover(parent1, parent2) {
    const child = new Array(this.courses.length);
    const crossoverPoint = Math.floor(Math.random() * this.courses.length);

    for (let i = 0; i < this.courses.length; i++) {
      const source = i < crossoverPoint ? parent1.schedule[i] : parent2.schedule[i];
      child[i] = source ? { ...source } : { dayIndex: -1 };
    }

    return child;
  }

  /**
   * Mutation - randomly change some assignments
   */
  mutate(schedule) {
    const mutated = schedule.map(a => a ? { ...a } : { dayIndex: -1, period: 1, isLocked: false });

    for (let i = 0; i < mutated.length; i++) {
      if (!mutated[i].isLocked && Math.random() < this.mutationRate) {
        // Randomly assign to a new day and period
        mutated[i] = { 
          dayIndex: Math.floor(Math.random() * this.calendar.length),
          period: Math.random() > 0.5 ? 1 : 2,
          isLocked: false
        };
      }
    }

    return mutated;
  }

  /**
   * Simulated Annealing for local optimization
   */
  simulatedAnnealing(initialSchedule) {
    let current = initialSchedule.map(a => a ? { ...a } : { dayIndex: -1 });
    let currentFitness = this.calculateFitness(current);
    let best = current.map(a => ({ ...a }));
    let bestFitness = currentFitness;
    let temp = this.initialTemp;
    
    while (temp > this.minTemp) {
      // Generate neighbor by swapping two random assignments or modifying one
      const neighbor = current.map(a => ({ ...a }));
      
      if (Math.random() > 0.5) {
        // Swap two exams
        const idx1 = Math.floor(Math.random() * neighbor.length);
        const idx2 = Math.floor(Math.random() * neighbor.length);
        if (!neighbor[idx1].isLocked && !neighbor[idx2].isLocked) {
          const tempSlot = { ...neighbor[idx1] };
          neighbor[idx1].dayIndex = neighbor[idx2].dayIndex;
          neighbor[idx1].period = neighbor[idx2].period;
          neighbor[idx2].dayIndex = tempSlot.dayIndex;
          neighbor[idx2].period = tempSlot.period;
        }
      } else {
        // Change period or day of one exam
        const idx = Math.floor(Math.random() * neighbor.length);
        if (!neighbor[idx].isLocked) {
          if (Math.random() > 0.5) {
            neighbor[idx].period = neighbor[idx].period === 1 ? 2 : 1;
          } else {
            neighbor[idx].dayIndex = Math.floor(Math.random() * this.calendar.length);
          }
        }
      }
      
      const neighborFitness = this.calculateFitness(neighbor);
      const delta = neighborFitness - currentFitness;
      
      if (delta < 0 || Math.random() < Math.exp(-delta / temp)) {
        current = neighbor;
        currentFitness = neighborFitness;
        
        if (currentFitness < bestFitness) {
          best = [...current];
          bestFitness = currentFitness;
        }
      }
      
      temp *= this.coolingRate;
    }
    
    return { schedule: best, fitness: bestFitness };
  }

  /**
   * Main optimization algorithm
   */
  optimize() {
    console.log('🧬 Starting Genetic Algorithm optimization...');
    console.log(`📊 Courses: ${this.courses.length}, Days: ${this.calendar.length}`);
    
    let population = this.createInitialPopulation();
    console.log(`✅ Initial population created. Best fitness: ${population[0].fitness}`);
    
    for (let gen = 0; gen < this.generations; gen++) {
      const newPopulation = [];
      
      // Elitism - keep best solutions
      for (let i = 0; i < this.eliteSize; i++) {
        newPopulation.push(population[i]);
      }
      
      // Generate offspring
      while (newPopulation.length < this.populationSize) {
        const parent1 = this.selectParent(population);
        const parent2 = this.selectParent(population);
        let child = this.crossover(parent1, parent2);
        child = this.mutate(child);
        
        newPopulation.push({
          schedule: child,
          fitness: this.calculateFitness(child)
        });
      }
      
      population = newPopulation.sort((a, b) => a.fitness - b.fitness);
      
      if (gen % 20 === 0) {
        console.log(`Generation ${gen}: Best fitness = ${population[0].fitness}`);
      }
    }
    
    console.log('🔥 Applying Simulated Annealing for fine-tuning...');
    const optimized = this.simulatedAnnealing(population[0].schedule);
    console.log(`✅ Final fitness: ${optimized.fitness}`);
    
    return this.convertToSchedule(optimized.schedule, optimized.fitness);
  }

  convertToSchedule(schedule, fitness) {
    const result = [];
    const violations = [];

    schedule.forEach((assignment, idx) => {
      const course = this.courses[idx];

      // Safety check for undefined assignment
      if (!assignment || assignment.dayIndex === undefined || assignment.dayIndex === null) {
        violations.push({
          type: 'UNSCHEDULED_COURSE',
          course: course.course_title,
          program: course.program,
          level: course.level,
          reason: 'Assignment is undefined or invalid'
        });
        return;
      }

      if (assignment.dayIndex === -1 || assignment.dayIndex >= this.calendar.length) {
        violations.push({
          type: 'UNSCHEDULED_COURSE',
          course: course.course_title,
          program: course.program,
          level: course.level,
          reason: 'No valid day found'
        });
        return;
      }

      const day = this.calendar[assignment.dayIndex];
      result.push({
        course_id: course.id,
        exam_date: day.dateStr,
        day_of_week: day.dayOfWeek,
        group_type: day.groupType,
        period: assignment.period,
        course: course
      });
    });
    return {
      schedule: result,
      violations,
      fitness,
      calendar: this.calendar,
      stats: {
        totalCourses: this.courses.length,
        scheduledCourses: result.length,
        unscheduledCourses: violations.length,
        optimizationScore: Math.max(0, 100 - fitness / 10)
      }
    };
  }

  generateSchedule() {
    const unassignedCount = this.courses.filter(c => !this.lockedAssignments[c.id]).length;
    if (unassignedCount === 0 && Object.keys(this.lockedAssignments).length > 0) {
      console.log('⚡ All courses are pre-scheduled/locked! Skipping GA/SA and returning schedule instantly.');
      const schedule = this.courses.map(course => {
        const lock = this.lockedAssignments[course.id];
        return {
          dayIndex: lock ? lock.dayIndex : 0,
          period: lock ? lock.period : 1,
          isLocked: true
        };
      });
      const fitness = this.calculateFitness(schedule);
      return this.convertToSchedule(schedule, fitness);
    }
    return this.optimize();
  }
}

export default AdvancedScheduler;

