# Contributing to Urbanity Backend

Thank you for your interest in contributing to the Urbanity Backend! This guide will help you get started with the development process.

## Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Focus on the code, not the person
- Help each other learn

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Git

### Development Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd back-end
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development server**
   ```bash
   npm run start:dev
   ```

4. **Run tests**
   ```bash
   npm run test
   npm run test:watch
   ```

## Development Workflow

### Creating a Feature Branch

```bash
git checkout -b feature/description-of-feature
```

### Code Style

- Use TypeScript strictly
- Follow the existing code style
- Use meaningful variable and function names
- Write comments for complex logic

### Formatting and Linting

Before committing, ensure your code is formatted and passes linting:

```bash
npm run format
npm run lint
```

These commands will auto-fix most issues.

### Writing Tests

- Write unit tests for new features
- Aim for at least 70% code coverage
- Test edge cases and error scenarios

```bash
npm run test          # Run all tests
npm run test:watch   # Run in watch mode
npm run test:cov     # With coverage report
```

## Module Structure

When creating a new feature, follow this structure:

```
src/modules/feature-name/
├── feature-name.module.ts      # Module definition
├── feature-name.controller.ts   # HTTP endpoints
├── feature-name.service.ts      # Business logic
├── dto/                         # Data Transfer Objects
│   ├── create-feature.dto.ts
│   └── update-feature.dto.ts
├── interfaces/                  # TypeScript interfaces
│   └── feature.interface.ts
└── feature-name.spec.ts         # Unit tests
```

### Example Module

1. **Create the module**
   ```bash
   nest generate module modules/feature-name
   ```

2. **Create controller**
   ```bash
   nest generate controller modules/feature-name
   ```

3. **Create service**
   ```bash
   nest generate service modules/feature-name
   ```

## API Conventions

### Endpoint Naming

- Use plural nouns: `/complaints`, `/users`, `/assignments`
- Use hierarchical relationships: `/complaints/:id/updates`
- Use query parameters for filtering: `/complaints?status=open`

### HTTP Methods

- `GET` - Retrieve resources
- `POST` - Create new resources
- `PUT` - Update entire resource
- `PATCH` - Partial update
- `DELETE` - Remove resource

### Response Format

```json
{
  "success": true,
  "data": { /* resource or array */ },
  "message": "Optional success message",
  "timestamp": "2024-05-04T08:30:00Z"
}
```

### Error Format

```json
{
  "success": false,
  "error": "Error Type",
  "message": "Human-readable error message",
  "statusCode": 400,
  "timestamp": "2024-05-04T08:30:00Z"
}
```

## Commit Messages

Use conventional commits format:

```
type(scope): subject

body (optional)
footer (optional)
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Code style changes (formatting, semicolons, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Build process, dependencies, etc.

**Examples:**
```
feat(complaints): add support for image attachments
fix(assignments): resolve race condition in status updates
docs(readme): update installation instructions
```

## Pull Request Process

1. **Create a descriptive branch name**
   ```bash
   git checkout -b feat/add-complaint-notifications
   ```

2. **Commit with meaningful messages**
   ```bash
   git commit -m "feat(notifications): add email notifications for complaint updates"
   ```

3. **Push to your fork**
   ```bash
   git push origin feat/add-complaint-notifications
   ```

4. **Create a Pull Request**
   - Use the PR template if available
   - Describe changes clearly
   - Reference related issues
   - Include screenshots if UI changes

5. **PR Guidelines**
   - Keep PRs focused (one feature per PR)
   - Add tests for new functionality
   - Update documentation if needed
   - Ensure all CI checks pass
   - Address review feedback promptly

## Testing Guidelines

### Unit Tests

Test individual functions and services:

```typescript
describe('ComplaintsService', () => {
  let service: ComplaintsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [ComplaintsService],
    }).compile();
    service = module.get<ComplaintsService>(ComplaintsService);
  });

  it('should create a complaint', () => {
    const result = service.create({...});
    expect(result).toBeDefined();
  });
});
```

### E2E Tests

Test complete workflows:

```bash
npm run test:e2e
```

## Documentation

- Update README for significant changes
- Document API endpoints in controller decorators
- Include JSDoc comments for complex functions
- Keep API documentation synchronized

## Reporting Issues

When reporting bugs, include:

- Clear description of the issue
- Steps to reproduce
- Expected behavior
- Actual behavior
- Environment details (Node version, OS, etc.)
- Error logs or stack traces

## Questions?

- Check existing issues and PRs
- Read the README and documentation
- Ask in pull request comments
- Create a discussion for architecture questions

## Thank You!

Your contributions help make Urbanity a better platform for smart city management. We appreciate your effort and time!

---

**Happy coding! 🚀**
