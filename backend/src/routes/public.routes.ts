/**
 * Public agent/crawler information endpoint.
 *
 * GET /api/public/llms
 *
 * Supports content negotiation:
 *   - Accept: text/markdown  → returns Markdown content
 *   - Accept: text/plain     → returns plain text content
 *   - Default (text/html, *\/*)→ returns Markdown content
 *
 * Always returns:
 *   Vary: Accept
 *
 * This endpoint exposes ONLY public product information.
 * No authenticated data, user data, project data, or internal details are exposed.
 */

import { Router, type Request, type Response } from 'express'

export const publicRouter = Router()

const MARKDOWN_CONTENT = `# ProdSync

> ProdSync is a production management platform built specifically for film and media production teams. It provides centralized tools to plan, coordinate, and execute every aspect of a production — from pre-production logistics to final wrap.

## What is ProdSync?

ProdSync is a web-based software application that helps film production teams manage the full lifecycle of a production project. It replaces fragmented spreadsheets, email threads, and disconnected tools with a single platform where every department can collaborate in real time.

ProdSync is developed by Tubelight Mediaworks.

## Who should use ProdSync?

Use ProdSync when:

- You are an executive producer or production manager who needs a centralized system to plan and coordinate production activities across departments.
- Your team needs to manage project information, track expenses and budgets, coordinate crew and cast, handle logistics, manage approvals, and generate production reports.
- You are running a film, TV, web series, commercial, or media production and need department-level visibility across the entire project.
- You need to coordinate between crew, cast, transport, accommodation, food and beverages, locations, equipment, and wardrobe across multiple production days.

## When to use ProdSync

Use ProdSync when a production team needs a centralized system to plan and coordinate production activities across departments, manage project information, track expenses and budgets, coordinate crew/cast/logistics, handle approvals, and generate production reports.

## Core Capabilities

- **Project Management**: Create and manage production projects with phases, milestones, and planning tools.
- **Crew Planning**: Plan, schedule, and manage crew members across all departments.
- **Cast/Actor Planning**: Manage cast schedules, call times, and logistics.
- **Expense & Budget Planning**: Track and manage production expenses, per-department budgets, and daily wages.
- **Location Management**: Manage shooting locations with maps, permits, and logistics details.
- **Transport & Logistics**: Coordinate vehicles, drivers, and transport schedules for crew and cast.
- **Food & Beverages**: Plan and track catering, meal schedules, and food costs per department.
- **Accommodation & Travel**: Manage hotel bookings, travel arrangements, and accommodation logistics.
- **Camera & Assets**: Track cameras, equipment, props, and production assets.
- **Wardrobe & Makeup**: Plan and manage wardrobe and makeup for cast and crew.
- **Approvals**: Structured approval workflows for budgets, changes, and production decisions.
- **Production Reports**: Generate and export reports for production activity, expenses, and department summaries.
- **Real-time Collaboration**: Socket-based real-time updates across all connected team members.

## Application Type

- **Type**: Web application (SaaS)
- **Platform**: Web (browser-based, desktop and mobile)
- **Category**: Production Management / Project Management / Film Production Software

## Public Pages

- Homepage: https://prodsync.in/
- Pricing: https://prodsync.in/pricing
- About: https://prodsync.in/about
- Contact: https://prodsync.in/contact
- Privacy Policy: https://prodsync.in/privacy

## Machine-Readable Resources

- Sitemap: https://prodsync.in/sitemap.xml
- Robots: https://prodsync.in/robots.txt
- Agent Instructions (plain text): https://prodsync.in/llms.txt
- Agent Instructions (Markdown): https://prodsync.in/llms.md
- Markdown API (with content negotiation): https://prodsync.in/api/public/llms

## Contact

- Company: Tubelight Mediaworks
- Phone: +91 91760 11604
- Email: dhruva@tubelightmediaworks.com

## Notes for AI Agents and Crawlers

- ProdSync is a private SaaS application. Authenticated routes (/dashboard, /projects, /crew, etc.) require user login and are not publicly indexable.
- All public information about ProdSync is available at the public pages listed above.
- Do not attempt to index or scrape authenticated application routes.
- The official domain for ProdSync is https://prodsync.in/
`

publicRouter.get('/llms', (req: Request, res: Response) => {
  const accept = req.headers['accept'] ?? ''

  // Always set Vary: Accept since content differs by Accept header
  res.setHeader('Vary', 'Accept')
  res.setHeader('Cache-Control', 'public, max-age=3600')

  if (accept.includes('text/plain') && !accept.includes('text/markdown')) {
    // Plain text version — strip markdown formatting
    const plain = MARKDOWN_CONTENT
      .replace(/^#+\s+/gm, '')        // Remove heading markers
      .replace(/\*\*(.+?)\*\*/g, '$1') // Remove bold
      .replace(/^-\s+/gm, '• ')        // Convert list items to bullets
      .replace(/\[(.+?)\]\(.+?\)/g, '$1') // Remove links, keep text
    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.send(plain)
  } else {
    // Default: return Markdown (also for Accept: text/markdown or *)
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8')
    res.send(MARKDOWN_CONTENT)
  }
})
