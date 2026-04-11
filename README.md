<img width="128" alt="favicon" src="https://github.com/user-attachments/assets/2b9e7761-bdfd-4e0d-af9f-4ffe89b5213e" />  

# KTM (Task Manager)

A full-stack task manager application with a Neo-Tokyo inspired design system.

<img width="1440" height="818" alt="Captura de pantalla 2026-04-10 a la(s) 7 45 17 p  m" src="https://github.com/user-attachments/assets/db24a169-ede1-4911-b2a4-2e5550fd5829" />


## Tech Stack

- **Backend**: Java 17 + Spring Boot 3 + PostgreSQL + JWT Authentication
- **Frontend**: React 18 + TypeScript + TailwindCSS + Zustand + React Query
- **Build**: Maven (backend) + Vite (frontend) + Docker

## Features

- User authentication (register/login with JWT)
- Create, edit, delete, and toggle tasks
- Filter tasks by status (all/active/completed)
- Search tasks
- Sort by date or alphabetically
- Dark/Light theme toggle
- Keyboard shortcuts (N: new task, /: search, Esc: close)
- Toast notifications
- PWA support (offline-capable frontend)

## Getting Started

### Prerequisites

- Node.js 18+
- Java 17+
- PostgreSQL (or Docker)

### Backend Setup

```bash
cd backend
```

Configure environment variables in `src/main/resources/application.properties` or as system properties:

```properties
# Database
DB_URL=jdbc:postgresql://localhost:5432/postgres
DB_USERNAME=postgres
DB_PASSWORD=your_password

# JWT
JWT_SECRET=your_256_bit_secret_key
JWT_EXPIRATION=86400000

# Server
SERVER_PORT=8080
```

Build and run:

```bash
./mvnw spring-boot:run
```

### Frontend Setup

```bash
cd frontend
```

Install dependencies:

```bash
npm install
```

Configure environment variables. Copy `.env.example` to `.env` and update:

```env
VITE_API_URL=http://localhost:8080
```

Start development server:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

## Design System

The frontend uses a Neo-Tokyo inspired design system with:

- **Colors**: Hot pink (#ff2d92), Cyan (#00e5ff), with additional accents (lime, violet, orange, blue)
- **Fonts**: Orbitron (display headings), Rubik (body text), JetBrains Mono (code/shortcuts)
- **Effects**: CRT scanlines, noise texture, vignette (dark mode only)
- **Animations**: Smooth cubic-bezier transitions, bounce-in, fade-in-up

### CSS Variables

All styling uses CSS custom properties defined in `src/styles/design-tokens.css`. Theme-aware components reference these variables for consistent styling across light/dark modes.

## Project Structure

```
├── backend/
│   ├── src/main/java/com/example/taskmanager/
│   │   ├── config/          # Security configuration
│   │   ├── controller/      # REST endpoints
│   │   ├── dto/            # Data transfer objects
│   │   ├── exception/      # Global exception handling
│   │   ├── model/         # Entity models
│   │   ├── repository/    # Data access
│   │   ├── security/      # JWT utilities
│   │   └── service/       # Business logic
│   └── src/test/           # Unit tests
│
├── frontend/
│   ├── src/
│   │   ├── api/           # API client
│   │   ├── components/   # React components
│   │   ├── hooks/        # Custom React hooks
│   │   ├── pages/        # Page components
│   │   ├── stores/       # Zustand state management
│   │   ├── styles/       # CSS and design tokens
│   │   └── types/       # TypeScript types
│   └── public/           # Static assets
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Create new account
- `POST /api/auth/login` - Login and get JWT token

### Tasks (requires authentication)
- `GET /api/tasks` - List all tasks
- `POST /api/tasks` - Create new task
- `PUT /api/tasks/{id}` - Update task
- `DELETE /api/tasks/{id}` - Delete task
- `PATCH /api/tasks/{id}/toggle` - Toggle task completion

### Admin (requires ADMIN role)
- `GET /api/admin/users` - List all users
- `PATCH /api/admin/users/{id}/roles` - Assign roles

## Keyboard Shortcuts

- `N` - New task
- `/` - Focus search
- `Esc` - Close form or clear search

## License

MIT
