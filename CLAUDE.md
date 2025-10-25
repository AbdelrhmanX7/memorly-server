# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Memorly is a financial resource tracking application backend built with Express.js, TypeScript, and MongoDB. The application manages financial records (profits and expenses) with categorization and color-coding support.

## Development Commands

### Running the server
```bash
yarn dev
```
Runs the development server using `ts-node-dev` with auto-reload and environment variable loading from `.env` file.

### Environment Setup
Create a `.env` file based on `.env.example`:
- `PORT`: Server port (defaults to 4000)
- `MONGODB_URI`: MongoDB connection string (defaults to `mongodb://127.0.0.1:27017/99tech-problem5`)

## Architecture

### Application Structure

The codebase follows a modular MVC-style architecture:

```
src/
├── index.ts          # Application entry point, Express setup, and server initialization
├── config/
│   └── db.ts         # MongoDB connection configuration
├── models/           # Mongoose schemas and TypeScript types
│   ├── index.ts      # Model exports
│   └── resource.ts   # Resource (profit/expense) model
├── routes/           # Express route definitions
│   ├── index.ts      # Main router (currently empty)
│   └── resource/
│       └── router.ts # Resource-specific routes (stub implementations)
├── controllers/      # Request handlers (currently empty)
└── validation/       # Input validation logic (currently empty)
```

### Data Model

**Resource Model** (`src/models/resource.ts`)
- Represents financial transactions (profit or expense)
- Fields:
  - `title`: string (required, max 100 chars)
  - `description`: string (optional, max 500 chars)
  - `type`: enum ['profit', 'expense'] (required)
  - `category`: string (required)
  - `categoryColor`: hex color code (optional, defaults to #3B82F6, validated via regex)
  - `amount`: number (required, min 0)
  - `date`: Date (required)
- Includes automatic `timestamps` (createdAt, updatedAt)

### Route Structure

Resource routes are defined in `src/routes/resource/router.ts` but currently have no handlers:
- `POST /create` - Create new resource
- `GET /resources` - List all resources
- `GET /resource/:id` - Get single resource
- `PUT /resource/:id` - Update resource
- `DELETE /resource/:id` - Delete resource

**Note:** Routes are defined but not yet connected to the main Express app in `src/index.ts`.

### TypeScript Configuration

- Strict mode enabled with additional type safety flags:
  - `noUncheckedIndexedAccess`: true
  - `exactOptionalPropertyTypes`: true
  - `noUncheckedSideEffectImports`: true
- Output: `dist/` directory
- Source maps and declaration files generated

## Key Implementation Details

### Database Connection
The app connects to MongoDB on startup via `connectDB()` in `src/index.ts:8`. Connection failures cause the process to exit with code 1.

### Middleware Stack
1. CORS enabled for all origins
2. JSON body parser
3. URL-encoded body parser with extended mode

### Validation Strategy
The Resource model uses Mongoose schema validation with a custom validator for hex color codes (`/^#([0-9A-F]{3}){1,2}$/i`).

## Development Notes

- Controllers and validation modules are stubbed out (empty directories exist)
- The main router (`src/routes/index.ts`) exists but is not imported/used in the application
- Resource routes are defined but not connected to the Express app
- Joi validation library is installed but not yet implemented
