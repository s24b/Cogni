'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  BookOpen,
  CaretRight,
  ArrowCounterClockwise,
  Archive,
  CaretDown,
  Warning,
  User,
  X,
} from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'framer-motion'
import { StaggerList, StaggerItem } from '@/components/ui/motion'

type CourseCard = {
  course_id: string
  name: string
  professor_id?: string | null
  professor_name: string | null
  topic_count: number
  card_count: number
  avg_coverage: number
  avg_mastery: number
  material_count: number
}

function CoverageBar({ coverage, mastery }: { coverage: number; mastery: number }) {
  const cPct = Math.round(coverage * 100)
  const mPct = Math.round(mastery * 100)
  const color = cPct >= 70 ? 'bg-emerald-500' : cPct >= 35 ? 'bg-amber-400' : 'bg-red-400'
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <span className="w-14 text-[10px] text-muted-foreground shrink-0">Coverage</span>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
          <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${cPct}%` }} />
        </div>
        <span className="w-6 text-right text-[10px] tabular-nums text-muted-foreground">{cPct}%</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-14 text-[10px] text-muted-foreground shrink-0">Mastery</span>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full transition-all ${mPct >= 75 ? 'bg-emerald-500' : mPct >= 40 ? 'bg-amber-400' : 'bg-red-400'}`}
            style={{ width: `${mPct}%` }}
          />
        </div>
        <span className="w-6 text-right text-[10px] tabular-nums text-muted-foreground">{mPct}%</span>
      </div>
    </div>
  )
}

function CourseGridCard({ course }: { course: CourseCard }) {
  const router = useRouter()
  const noContent = course.topic_count === 0
  const noMaterial = course.topic_count > 0 && course.avg_coverage === 0

  return (
    <button
      onClick={() => router.push(`/courses/${course.course_id}`)}
      className="flex w-full flex-col gap-3 rounded-xl border border-border bg-card p-4 text-left hover:bg-muted/20 active:scale-[0.99] transition-all"
    >
      <div className="flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <BookOpen size={18} className="text-primary" weight="fill" />
        </div>
        <div className="flex flex-1 flex-col min-w-0">
          <span className="text-sm font-semibold text-foreground leading-tight truncate">{course.name}</span>
          {course.professor_name && (
            <span className="mt-0.5 text-xs text-muted-foreground truncate">{course.professor_name}</span>
          )}
        </div>
        <CaretRight size={14} className="text-muted-foreground/60 shrink-0 mt-0.5" />
      </div>

      {noContent ? (
        <div className="flex items-center gap-1.5 rounded-lg bg-amber-500/10 px-2.5 py-1.5">
          <Warning size={13} className="text-amber-500 shrink-0" weight="fill" />
          <span className="text-[11px] text-amber-600 dark:text-amber-400">No topics yet — upload a syllabus</span>
        </div>
      ) : noMaterial ? (
        <div className="flex items-center gap-1.5 rounded-lg bg-amber-500/10 px-2.5 py-1.5">
          <Warning size={13} className="text-amber-500 shrink-0" weight="fill" />
          <span className="text-[11px] text-amber-600 dark:text-amber-400">Upload notes to build coverage</span>
        </div>
      ) : (
        <CoverageBar coverage={course.avg_coverage} mastery={course.avg_mastery} />
      )}

      <div className="flex items-center gap-3 border-t border-border/50 pt-2.5">
        <span className="text-[11px] text-muted-foreground">{course.topic_count} topics</span>
        <span className="text-muted-foreground/30">·</span>
        <span className="text-[11px] text-muted-foreground">{course.card_count} cards</span>
        {course.material_count > 0 && (
          <>
            <span className="text-muted-foreground/30">·</span>
            <span className="text-[11px] text-muted-foreground">{course.material_count} materials</span>
          </>
        )}
      </div>
    </button>
  )
}

function ProfessorWikiModal({ name, wiki, onClose }: { name: string | null; wiki: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-background/80 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-xl max-h-[70vh] flex flex-col"
      >
        <div className="flex items-center justify-between mb-3 shrink-0">
          <div className="flex items-center gap-2">
            <User size={15} className="text-primary" weight="fill" />
            <span className="text-sm font-semibold text-foreground">{name ?? 'Professor'} Profile</span>
          </div>
          <button onClick={onClose} className="flex size-6 items-center justify-center rounded text-muted-foreground hover:text-foreground">
            <X size={13} />
          </button>
        </div>
        <div className="overflow-y-auto text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
          {wiki}
        </div>
      </motion.div>
    </div>
  )
}

function ArchivedCourseRow({ course, professorWiki, onReactivate }: { course: CourseCard; professorWiki: string | null; onReactivate: () => void }) {
  const [loading, setLoading] = useState(false)
  const [showWiki, setShowWiki] = useState(false)

  async function handleReactivate() {
    setLoading(true)
    try {
      await fetch(`/api/courses/${course.course_id}/archive`, { method: 'DELETE' })
      onReactivate()
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
          <Archive size={15} className="text-muted-foreground" weight="fill" />
        </div>
        <div className="flex flex-1 flex-col min-w-0">
          <span className="text-sm font-medium text-foreground truncate">{course.name}</span>
          {course.professor_name && (
            <span className="text-xs text-muted-foreground">{course.professor_name}</span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {professorWiki && (
            <button
              onClick={() => setShowWiki(true)}
              className="flex items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/80 transition-colors"
            >
              <User size={11} weight="fill" />
              Profile
            </button>
          )}
          <button
            onClick={handleReactivate}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 disabled:opacity-50 transition-colors"
          >
            <ArrowCounterClockwise size={12} weight="bold" />
            Reactivate
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showWiki && professorWiki && (
          <ProfessorWikiModal
            name={course.professor_name}
            wiki={professorWiki}
            onClose={() => setShowWiki(false)}
          />
        )}
      </AnimatePresence>
    </>
  )
}

type ArchivedCourseCard = CourseCard & { professor_wiki: string | null }

export function CoursesClient({
  courses,
  archivedCourses,
}: {
  courses: CourseCard[]
  archivedCourses: ArchivedCourseCard[]
}) {
  const router = useRouter()
  const [showArchived, setShowArchived] = useState(false)

  if (courses.length === 0 && archivedCourses.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center p-6">
        <BookOpen size={36} className="text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">No courses yet. Complete onboarding to get started.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <div className="flex flex-col gap-6 p-6 max-w-3xl">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-foreground">Courses</h1>
          <p className="mt-1 text-sm text-muted-foreground">Tap a course to practice, view materials, and track progress.</p>
        </div>

        {courses.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-center rounded-xl border border-dashed border-border">
            <BookOpen size={28} className="text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">All courses archived.</p>
          </div>
        ) : (
          <StaggerList className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {courses.map(course => (
              <StaggerItem key={course.course_id}>
                <CourseGridCard course={course} />
              </StaggerItem>
            ))}
          </StaggerList>
        )}

        {archivedCourses.length > 0 && (
          <div className="flex flex-col gap-3">
            <button
              onClick={() => setShowArchived(v => !v)}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {showArchived ? <CaretDown size={14} /> : <CaretRight size={14} />}
              <Archive size={14} />
              {archivedCourses.length} archived {archivedCourses.length === 1 ? 'course' : 'courses'}
            </button>
            {showArchived && (
              <StaggerList className="flex flex-col gap-2">
                {archivedCourses.map(course => (
                  <StaggerItem key={course.course_id}>
                    <ArchivedCourseRow
                      course={course}
                      professorWiki={course.professor_wiki}
                      onReactivate={() => router.refresh()}
                    />
                  </StaggerItem>
                ))}
              </StaggerList>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
