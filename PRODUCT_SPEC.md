# WeekFlow — Product Specification

## Product Purpose

WeekFlow is a simple web-based weekly reporting tool designed to make weekly work planning, daily activity recording, follow-up tracking, and weekly report creation easier.

The initial real-world use case is a field-based professional who currently spends significant time manually preparing weekly work plans and weekly field activity reports.

The product should reduce the amount of repetitive writing and reconstruction required at the end of each week.

## Core Promise

Plan your week.
Capture what happened.
Track what still needs attention.
Generate your weekly report.

## Core Workflow

PLAN → CAPTURE → FOLLOW UP → REPORT

---

# V1 FEATURES

V1 consists of:

1. Weekly Setup
2. Weekly Plan
3. Daily Activity Capture
4. Follow-up Tracking
5. Weekly Overview
6. Weekly Report Generation
7. DOCX Export

Features should be implemented incrementally rather than all at once.

---

# WEEKLY PLAN

The Weekly Plan allows the user to plan activities for Monday through Friday.

Each day can contain:

- Facilities / Accounts
- HCPs / Stakeholders
- Primary Objectives
- Virtual Engagements
- Account-Specific Objectives
- Commercial Priorities
- Success Measures

Users should be able to:

- Add items
- Edit items
- Delete items
- Select the reporting week
- Save the plan locally

The Weekly Plan should be associated with its reporting week.

---

# DAILY ACTIVITY CAPTURE

Daily Activity Capture records what actually happened during the day.

Each day can contain:

- Facilities visited
- HCPs / Stakeholders engaged
- Activities performed
- Outcomes
- Key intelligence
- Commercial / Patient-Journey outcomes
- Follow-up actions

The user should be able to record information quickly without needing to write a polished report.

The Weekly Plan should eventually provide relevant planned information so the user does not have to enter the same information twice.

---

# FOLLOW-UPS

Follow-ups represent unfinished actions or items requiring further attention.

Each follow-up should contain:

- Description
- Related facility/account
- Due date
- Status
- Optional notes

Statuses:

- Open
- Completed

Follow-ups should eventually be carried forward into future weeks.

---

# WEEKLY REPORT

The generated report should contain:

1. Report heading
2. Employee information
3. Reporting week
4. Activities Summary
5. Daily Activity Breakdown
6. Virtual Engagements
7. Key Commercial / Patient-Journey Outcomes
8. Strategic Account Intelligence
9. Priorities for the Coming Week

The report structure should be based on the user's existing real-world weekly reporting workflow.

The application should collect structured information throughout the week so that the user does not need to reconstruct the entire week's activities manually when preparing the report.

---

# REPORT GENERATION

The report should be generated from information already entered into the application.

The first version should prioritize reliable structured output.

AI-assisted writing is a future feature and should NOT be implemented in the initial V1 unless explicitly requested.

---

# DOCX EXPORT

V1 should eventually allow the completed weekly report to be exported as a DOCX document.

The exported document should follow the application's report structure and should be suitable for professional submission.

DOCX export should be implemented only after the underlying reporting workflow is working correctly.

---

# START FROM PREVIOUS WEEK

A future feature should allow the user to start a new week using the previous week's information.

Potential carry-forward information includes:

- Unfinished objectives
- Open follow-ups
- Relevant facilities
- Recurring contacts
- Unresolved opportunities
- Next-week priorities

Do not implement this feature until the core V1 workflow is stable.

---

# MEETING PLANNER

Meeting planning is a future feature.

It may eventually support:

- Meeting type
- Date
- Institution / account / city
- Specialty
- Meeting title
- Expected attendance
- Product focus
- Expenses
- Expected ROI
- Approval status
- Support requirements

DO NOT implement the Meeting Planner in V1.

---

# DATA AND PERSISTENCE

The initial version should use browser localStorage where persistence is required.

Do not introduce a backend or database during the initial V1 development unless explicitly requested.

The architecture should allow a backend to be introduced later without requiring a complete rewrite.

WeekFlow uses a canonical `TemplateSchema` for template-specific planning categories, activity types and fields, follow-up fields, intelligence capabilities, and report section metadata. Runtime adapters resolve the selected template through this schema while preserving the shared local persistence model. Template selection does not create template-specific storage keys, rename persisted fields, migrate stored objects, or change existing weekly plan, daily activity, and follow-up contracts.

Report sections also declare canonical `dataGroups`. The shared `ReportSnapshot` remains the calculation source, and `reportDataMapper` resolves each section's groups to existing snapshot data. Groups without a current snapshot source are reported as unsupported rather than substituted with unrelated data. Report calculations and DOCX/PDF presentation remain shared concerns; template-specific presentation is handled separately from this mapping layer.

Each registered template owns its report sections, section ordering, report terminology, declared data groups, supported or unsupported data behavior, and report presentation metadata such as display type, layout preference, empty state, and visibility when empty. Report Preview, DOCX export, and PDF export consume the same schema-driven mapped report sections. WeekFlow does not assume one universal Field Sales report for every template.

---

# TECHNICAL DIRECTION

Current stack:

- React
- TypeScript
- Vite
- CSS

Keep dependencies minimal.

Prefer reusable components and clear separation of concerns.

Create appropriate TypeScript types for application data.

Keep storage logic separate from UI components where practical.

---

# DESIGN DIRECTION

WeekFlow should feel like a modern personal work assistant.

The interface should be:

- Clean
- Professional
- Calm
- Minimal
- Fast
- Mobile-friendly
- Easy to understand
- Efficient for repeated weekly use

Avoid making it look like:

- Enterprise HR software
- A generic admin dashboard
- Accounting software
- A complex CRM
- A project-management platform

Avoid unnecessary:

- Charts
- Analytics
- Statistics
- Animations
- Decorative elements
- Complex dashboards
- Large forms

The user's workflow should always take priority over visual decoration.

---

# IMPORTANT UX PRINCIPLE

The user should not have to write polished prose while recording activities.

The application should make it extremely easy to capture quick notes and structured information during or immediately after work activities.

The final report is where information becomes organized and professionally presented.

---

# V1 NON-GOALS

Do NOT build:

- HR management
- Payroll
- Attendance management
- Employee management
- Team management
- Enterprise administration
- Complex analytics
- Approval workflows
- Payment processing
- Subscription billing
- Mobile application
- CRM functionality
- AI report writing
- Meeting Planner
- Complex notification systems

Do not add functionality simply because it is technically possible.

---

# PRODUCT PRINCIPLE

WeekFlow solves one primary problem:

"Make weekly reporting much faster and easier."

Every feature should be evaluated against that goal.

If a proposed feature does not directly improve planning, activity capture, follow-up management, or report generation, it should not be added to V1 without explicit approval.

## Universal WeekFlow Identity

WeekFlow is a reusable multi-template weekly execution platform. It must not contain hardcoded employee names, employer names, customer or company names, product portfolios, or organization-specific report metadata.

Templates own their terminology, planning categories, activity types, activity fields, structured outcomes, intelligence interpretation, report sections, and export presentation.

Reports are generated from the selected template and existing WeekFlow data. The same report data source supports both Word (`.docx`) and PDF (`.pdf`) export.

Word and PDF exports use native A4 document layouts with professional margins, hierarchy, wrapping, pagination, page numbering, and neutral WeekFlow footers. Exporters consume the shared `MappedReportSection[]` representation, preserve explicit empty and unsupported states, and generate dynamic template-and-period filenames. No personal or company identity metadata is embedded universally.

---

# DEVELOPMENT PRINCIPLE

Build the product incrementally.

Do not implement multiple major features in one step.

Recommended development order:

1. Application shell
2. Weekly Plan
3. Daily Activity Capture
4. Follow-ups
5. Weekly Overview
6. Report Generation
7. DOCX Export
8. Future enhancements

Each feature should be tested before the next major feature is implemented.
