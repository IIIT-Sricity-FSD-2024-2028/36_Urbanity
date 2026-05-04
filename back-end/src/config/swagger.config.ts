import { DocumentBuilder } from '@nestjs/swagger';
import { ACTOR_ROLES } from '../data/schemas';

export const swaggerConfig = new DocumentBuilder()
  .setTitle('Urbanity API')
  .setDescription('In-memory NestJS CRUD API with role-based access control.')
  .setVersion('1.0.0')
  .addGlobalParameters({
    name: 'role',
    in: 'header',
    required: true,
    description:
      'RBAC actor role. Admin has full access; other actors have read-only GET access.',
    schema: {
      type: 'string',
      enum: [...ACTOR_ROLES],
    },
  })
  .build();
