import { Link } from "react-router";
import { useState, useEffect } from "react";
import type { Route } from "./+types/home";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "~/components/ui/card";
import { CourseStatus } from "~/db/schema";
import { LandingBenefits } from "~/components/landing-benefits";
import { LandingCourseArtwork } from "~/components/landing-course-artwork";
import {
  BookOpen,
  GraduationCap,
  Users,
  ArrowRight,
  User,
  Moon,
  Sun,
} from "lucide-react";
import { DevUI } from "~/components/dev-ui";
import { getCurrentUserId, getDevCountry } from "~/lib/session";
import { getCountryTierInfo, COUNTRIES } from "~/lib/ppp";
import { eq, like, and, or, sql } from "drizzle-orm";
import { db } from "~/db";
import { courses, categories, users, modules, lessons } from "~/db/schema";

function getAllUsers() {
  return db.select().from(users).all();
}

function getUserById(id: number) {
  return db.select().from(users).where(eq(users.id, id)).get();
}

function getAllCategories() {
  return db.select().from(categories).orderBy(categories.name).all();
}

function buildCourseQuery(
  search: string | null,
  category: string | null,
  status: CourseStatus | null,
  sortBy: string | null,
  limit: number,
  offset: number
) {
  const conditions = [];

  if (status) {
    conditions.push(eq(courses.status, status));
  }

  if (search) {
    const term = `%${search}%`;
    conditions.push(
      or(like(courses.title, term), like(courses.description, term))
    );
  }

  const query = db
    .select({
      id: courses.id,
      title: courses.title,
      slug: courses.slug,
      description: courses.description,
      salesCopy: courses.salesCopy,
      instructorId: courses.instructorId,
      categoryId: courses.categoryId,
      status: courses.status,
      coverImageUrl: courses.coverImageUrl,
      price: courses.price,
      pppEnabled: courses.pppEnabled,
      createdAt: courses.createdAt,
      updatedAt: courses.updatedAt,
      instructorName: users.name,
      instructorAvatarUrl: users.avatarUrl,
      categoryName: categories.name,
    })
    .from(courses)
    .innerJoin(users, eq(courses.instructorId, users.id))
    .innerJoin(categories, eq(courses.categoryId, categories.id));

  if (category) {
    conditions.push(eq(categories.slug, category));
  }

  const filtered =
    conditions.length > 0 ? query.where(and(...conditions)) : query;

  const sorted =
    sortBy === "title"
      ? filtered.orderBy(courses.title)
      : sortBy === "oldest"
        ? filtered.orderBy(courses.createdAt)
        : filtered.orderBy(sql`${courses.createdAt} DESC`);

  return sorted.limit(limit).offset(offset).all();
}

function getLessonCountForCourse(courseId: number) {
  const courseModules = db
    .select({ id: modules.id })
    .from(modules)
    .where(eq(modules.courseId, courseId))
    .all();

  if (courseModules.length === 0) return 0;

  const count = db
    .select({ count: sql<number>`count(*)` })
    .from(lessons)
    .where(or(...courseModules.map((m) => eq(lessons.moduleId, m.id))))
    .get();

  return count?.count ?? 0;
}

export function meta() {
  return [
    { title: "Cadence — Build skills at your own pace" },
    {
      name: "description",
      content:
        "Explore self-paced courses for developers. Learn from experienced instructors, track your progress, and practice with quizzes.",
    },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const courses = buildCourseQuery(
    null,
    null,
    CourseStatus.Published,
    "newest",
    50,
    0
  );
  const featured = courses.slice(0, 3).map((course) => ({
    ...course,
    lessonCount: getLessonCountForCourse(course.id),
  }));
  const categories = getAllCategories();
  const users = getAllUsers();
  const currentUserId = await getCurrentUserId(request);
  const currentUser = currentUserId ? getUserById(currentUserId) : null;
  const devCountry = await getDevCountry(request);
  const countryTierInfo = getCountryTierInfo(devCountry);

  return {
    featuredCourses: featured,
    totalCourses: courses.length,
    totalCategories: categories.length,
    users: users.map((u) => ({ id: u.id, name: u.name, role: u.role })),
    currentUser: currentUser
      ? { id: currentUser.id, name: currentUser.name, role: currentUser.role }
      : null,
    devCountry,
    countryTierInfo,
    countries: COUNTRIES,
  };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const {
    featuredCourses,
    totalCourses,
    totalCategories,
    users,
    currentUser,
    devCountry,
    countryTierInfo,
    countries,
  } = loaderData;
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggleDarkMode() {
    const next = !document.documentElement.classList.contains("dark");
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("cadence-theme", next ? "dark" : "light");
    } catch {}
  }

  return (
    <div className="landing-page min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link
            to="/"
            className="flex shrink-0 items-center gap-2 text-lg font-bold tracking-tight"
          >
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-sm text-primary-foreground">
              C
            </span>
            <span>Cadence</span>
          </Link>
          <nav
            aria-label="Main navigation"
            className="flex shrink-0 items-center gap-1 sm:gap-6"
          >
            <Link
              to="/courses"
              className="whitespace-nowrap rounded-md px-1 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-0"
            >
              Courses
            </Link>
            <button
              type="button"
              onClick={toggleDarkMode}
              aria-label={
                isDark ? "Switch to light mode" : "Switch to dark mode"
              }
              aria-pressed={isDark}
              className="rounded-md p-2 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {isDark ? (
                <Sun aria-hidden="true" className="size-4" />
              ) : (
                <Moon aria-hidden="true" className="size-4" />
              )}
            </button>
            {currentUser ? (
              <Button asChild size="sm">
                <Link to="/dashboard">Dashboard</Link>
              </Button>
            ) : (
              <>
                <Link
                  to="/login"
                  className="whitespace-nowrap rounded-md px-1 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-0"
                >
                  Log In
                </Link>
                <Button asChild size="sm">
                  <Link to="/signup" className="whitespace-nowrap">
                    Sign Up
                  </Link>
                </Button>
              </>
            )}
          </nav>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
          <div className="grid overflow-hidden rounded-[2rem] bg-foreground text-background shadow-xl lg:grid-cols-[1.05fr_0.95fr]">
            <div className="flex flex-col items-start justify-center px-6 py-12 sm:px-10 sm:py-16 lg:px-14">
              <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-background/30 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-background">
                <span className="size-2 rounded-full bg-accent" />
                Learn at your own pace
              </p>
              <h1 className="max-w-2xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
                Make room for your next skill.
              </h1>
              <p className="mt-6 max-w-xl text-base leading-7 text-background/85 sm:text-lg">
                Build practical skills with instructor-led courses, track your
                progress, and practice with quizzes—on a schedule that works for
                you.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Button asChild size="lg">
                  <Link to="/courses">
                    Explore courses
                    <ArrowRight aria-hidden="true" className="ml-2 size-4" />
                  </Link>
                </Button>
                <span className="text-sm font-medium text-background/80">
                  Choose a course. Set your pace.
                </span>
              </div>
            </div>
            <div className="relative flex min-h-80 items-center justify-center overflow-hidden bg-secondary p-6 sm:p-10 lg:min-h-full">
              <div
                aria-hidden="true"
                className="absolute -right-20 -top-24 size-72 rounded-full border-[36px] border-background/15"
              />
              <div
                aria-hidden="true"
                className="absolute -bottom-24 -left-16 size-64 rounded-full bg-primary/40"
              />
              {featuredCourses[0] ? (
                <Link
                  to={`/courses/${featuredCourses[0].slug}`}
                  className="group relative w-full max-w-md overflow-hidden rounded-3xl border border-background/40 bg-card text-card-foreground shadow-2xl transition-transform hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-background"
                >
                  <LandingCourseArtwork
                    category={featuredCourses[0].categoryName ?? "Course"}
                    className="aspect-[4/3]"
                  />
                  <div className="space-y-3 p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      Start with a course
                    </p>
                    <h2 className="text-xl font-bold leading-tight">
                      {featuredCourses[0].title}
                    </h2>
                    <div className="flex items-center justify-between gap-4 text-sm">
                      <span className="text-muted-foreground">
                        {featuredCourses[0].instructorName ??
                          "Course instructor"}
                      </span>
                      <span className="inline-flex items-center gap-2 font-semibold text-foreground">
                        View course
                        <ArrowRight aria-hidden="true" className="size-4" />
                      </span>
                    </div>
                  </div>
                </Link>
              ) : (
                <div className="relative flex aspect-[4/3] w-full max-w-md flex-col items-center justify-center rounded-3xl border border-background/40 bg-foreground p-8 text-center text-background shadow-2xl">
                  <BookOpen aria-hidden="true" className="mb-5 size-12" />
                  <p className="text-2xl font-bold">
                    Your next lesson starts here.
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>

        <section
          aria-label="Cadence at a glance"
          className="mx-auto grid max-w-7xl grid-cols-1 gap-4 px-4 py-6 sm:grid-cols-3 sm:px-6"
        >
          <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-foreground">
              <BookOpen aria-hidden="true" className="size-6" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalCourses}</p>
              <p className="text-sm text-muted-foreground">
                Courses to explore
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-secondary/10 text-foreground">
              <GraduationCap aria-hidden="true" className="size-6" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalCategories}</p>
              <p className="text-sm text-muted-foreground">Course categories</p>
            </div>
          </div>
          <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-foreground">
              <Users aria-hidden="true" className="size-6" />
            </div>
            <div>
              <p className="text-2xl font-bold">Self-paced</p>
              <p className="text-sm text-muted-foreground">
                Learn on your schedule
              </p>
            </div>
          </div>
        </section>

        <LandingBenefits />

        {featuredCourses.length > 0 && (
          <section
            aria-labelledby="featured-courses-title"
            className="border-y border-border bg-card/70 py-16 sm:py-20"
          >
            <div className="mx-auto max-w-7xl px-4 sm:px-6">
              <div className="mb-10 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-foreground">
                    Find your starting point
                  </p>
                  <h2
                    id="featured-courses-title"
                    className="text-3xl font-bold tracking-tight sm:text-4xl"
                  >
                    Courses to explore
                  </h2>
                  <p className="mt-3 max-w-xl text-muted-foreground">
                    Choose a topic that interests you and take the next step at
                    your own pace.
                  </p>
                </div>
                <Button asChild variant="outline">
                  <Link to="/courses">
                    Browse all courses
                    <ArrowRight aria-hidden="true" className="ml-2 size-4" />
                  </Link>
                </Button>
              </div>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {featuredCourses.map((course) => (
                  <Link
                    key={course.id}
                    to={`/courses/${course.slug}`}
                    className="group rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Card className="h-full overflow-hidden pt-0 transition-all group-hover:-translate-y-1 group-hover:shadow-lg">
                      <LandingCourseArtwork
                        category={course.categoryName}
                        className="aspect-video"
                      />
                      <CardHeader>
                        <h3 className="font-semibold leading-snug group-hover:underline">
                          {course.title}
                        </h3>
                      </CardHeader>
                      <CardContent>
                        <p className="line-clamp-2 text-sm text-muted-foreground">
                          {course.description}
                        </p>
                      </CardContent>
                      <CardFooter className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <User aria-hidden="true" className="size-3" />
                          {course.instructorName ?? "Instructor"}
                        </span>
                        <span className="flex items-center gap-1">
                          <BookOpen aria-hidden="true" className="size-3" />
                          {course.lessonCount} lessons
                        </span>
                      </CardFooter>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>

      <footer className="border-t border-border py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 text-sm text-muted-foreground sm:flex-row sm:px-6">
          <Link to="/" className="font-bold text-foreground">
            Cadence
          </Link>
          <p>Learn at your own pace.</p>
          <Link
            to="/courses"
            className="font-semibold text-foreground hover:underline"
          >
            Explore courses
          </Link>
        </div>
      </footer>

      <DevUI
        users={users}
        currentUser={currentUser}
        devCountry={devCountry}
        countryTierInfo={countryTierInfo}
        countries={countries}
      />
    </div>
  );
}
