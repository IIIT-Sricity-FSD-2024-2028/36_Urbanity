# Urbanity Backend

A NestJS-based backend service for the **Urbanity - Urban Service Request & Issue Management Platform**, enabling citizens, departments, and field workers to efficiently manage civic complaints, track progress, and ensure accountability.

## Overview

Urbanity is a smart city platform designed to streamline the process of reporting, managing, and resolving civic issues such as road damage, waste management, water supply problems, and streetlight failures. The backend provides comprehensive APIs for user management, complaint handling, assignments, tracking, and analytics.

## Key Features

- **Multi-role User Management**: Support for Citizens, Department Officers, Field Workers, Department Heads, and Admins
- **Complaint Management**: Create, track, and update service requests with location and media attachments
- **Task Assignment**: Intelligent routing and assignment of complaints to appropriate departments and field workers
- **Real-time Tracking**: Progress updates and status tracking for complaints
- **Feedback & Support System**: Citizens can provide feedback and vote on complaints
- **Analytics & Reports**: Department-level dashboards and performance reports
- **Role-Based Access Control (RBAC)**: Secure endpoints with fine-grained permissions
- **API Documentation**: Auto-generated Swagger documentation

## Tech Stack

- **Framework**: [NestJS](https://nestjs.com/) - Progressive Node.js framework
- **Language**: TypeScript
- **Testing**: Jest
- **Documentation**: Swagger/OpenAPI
- **Validation**: Class-Validator & Class-Transformer
- **Code Quality**: ESLint & Prettier

## Project Structure

```
src/
├── main.ts                    # Application entry point
├── app.module.ts              # Root module
├── config/                    # Configuration files
│   ├── app.config.ts         # App settings (port, CORS, etc.)
│   └── swagger.config.ts      # Swagger/OpenAPI configuration
├── common/                    # Shared utilities & middleware
│   ├── decorators/           # Custom decorators
│   ├── guards/               # Authentication/authorization guards
│   ├── enums/                # Global enums
│   ├── filters/              # Exception filters
│   ├── interceptors/         # Request/response interceptors
│   ├── pipes/                # Validation pipes
│   └── interfaces/           # TypeScript interfaces
├── data/
│   └── store.ts              # In-memory data storage
└── modules/                  # Feature modules
    ├── auth/                 # Authentication & authorization
    ├── users/                # User management
    ├── roles/                # Role definitions & management
    ├── departments/          # Department management
    ├── offices/              # Office/branch management
    ├── cities/               # City management
    ├── areas/                # Geographic area management
    ├── complaints/           # Complaint/service request management
    ├── assignments/          # Task assignment workflow
    ├── complaint-updates/    # Progress tracking & status updates
    ├── attachments/          # File upload & media management
    ├── supports/             # Complaint support & upvoting
    ├── feedback/             # Citizen feedback system
    ├── dashboard/            # Department analytics & overview
    └── reports/              # Performance & resolution reports
```

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run start:dev
```

The API will be available at `http://localhost:3000`

### API Documentation

Interactive Swagger documentation is auto-generated and available at:
```
http://localhost:3000/api/docs
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run start` | Start the production server |
| `npm run start:dev` | Start the development server with hot-reload |
| `npm run start:debug` | Start in debug mode with debugger enabled |
| `npm run start:prod` | Build and start production server |
| `npm run build` | Compile TypeScript to JavaScript |
| `npm run format` | Format code using Prettier |
| `npm run lint` | Run ESLint and fix issues |
| `npm run test` | Run unit tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:cov` | Run tests with coverage report |
| `npm run test:debug` | Debug tests in Node inspector |
| `npm run test:e2e` | Run end-to-end tests |

## API Endpoints Overview

### Authentication
- `POST /auth/login` - User login
- `POST /auth/logout` - User logout
- `POST /auth/refresh` - Refresh authentication token

### Users
- `GET /users` - List all users
- `POST /users` - Create new user
- `GET /users/:id` - Get user details
- `PUT /users/:id` - Update user
- `DELETE /users/:id` - Delete user

### Complaints
- `GET /complaints` - List complaints
- `POST /complaints` - Create complaint
- `GET /complaints/:id` - Get complaint details
- `PUT /complaints/:id` - Update complaint status
- `DELETE /complaints/:id` - Delete complaint

### Assignments
- `GET /assignments` - List task assignments
- `POST /assignments` - Create assignment
- `PUT /assignments/:id` - Update assignment

### Reports
- `GET /dashboard` - Department dashboard stats
- `GET /reports` - Generate performance reports

For complete API details, refer to the Swagger documentation.

## Development Guidelines

### Code Style

The project uses **Prettier** for formatting and **ESLint** for linting. Code is automatically formatted on save in most IDEs.

To manually format:
```bash
npm run format
```

To lint:
```bash
npm run lint
```

### Creating New Modules

Follow the NestJS module pattern:
```
modules/
├── feature-name/
│   ├── feature-name.module.ts
│   ├── feature-name.controller.ts
│   ├── feature-name.service.ts
│   ├── dto/
│   │   ├── create-feature.dto.ts
│   │   └── update-feature.dto.ts
│   └── feature-name.spec.ts
```

### Testing

Write unit tests alongside your code:
```bash
npm run test
npm run test:watch      # Watch mode for development
npm run test:cov        # Coverage report
```

## Error Handling

The application uses global exception filters to provide consistent error responses. All errors are returned with appropriate HTTP status codes and descriptive messages.

## Security Considerations

- Role-Based Access Control (RBAC) enforced on protected endpoints
- Input validation using pipes and DTOs
- CORS configured for safe cross-origin requests
- Environment-based configuration

## Performance Optimization

- Global validation pipes prevent invalid data from entering the system
- Interceptors handle cross-cutting concerns efficiently
- Module-based architecture allows for easy scaling and optimization

## Deployment

### Production Build

```bash
npm run build
npm run start:prod
```

The built application is output to the `dist/` directory.

### Docker Support (if applicable)

Build and run with Docker:
```bash
docker build -t urbanity-backend .
docker run -p 3000:3000 urbanity-backend
```

## Contributing

1. Create a feature branch: `git checkout -b feature/your-feature`
2. Commit changes: `git commit -m "Add your feature"`
3. Push to branch: `git push origin feature/your-feature`
4. Submit a pull request

## Troubleshooting

### Port Already in Use

If port 3000 is already in use, modify the port in `src/config/app.config.ts` or set the `PORT` environment variable.

### Module Not Found Error

Ensure all dependencies are installed:
```bash
npm install
npm run build
```

### Tests Failing

Clear Jest cache and reinstall dependencies:
```bash
npm run test -- --clearCache
```

## Future Enhancements

- Database integration (MongoDB/PostgreSQL)
- Authentication with JWT tokens
- Email and SMS notifications
- Mobile app API support
- Advanced analytics and ML-based prioritization
- Integration with IoT sensors
- Real-time updates using WebSockets

## Support

For issues, questions, or suggestions, please open an issue in the repository or contact the development team.

## License

UNLICENSED - Academic Project

---

**Part of the Urbanity Smart City Platform** - A full-stack development project focused on real-world civic complaint management.
