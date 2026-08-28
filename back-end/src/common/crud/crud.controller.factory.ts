import {
  Body,
  BadRequestException,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Type,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiExtraModels,
  ApiBearerAuth,
  ApiBadRequestResponse,
  ApiBody,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { hashSync } from 'bcryptjs';
import { RoleName } from '../enums/roles.enum';
import { apiResponse } from '../api-response';
import type { ApiResponse } from '../api-response';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { CrudService } from './crud.service';
import { ResourceDefinition, serviceToken } from '../../data/urbanity.resources';

export function createUrbanityController(resource: ResourceDefinition): Type {
  @ApiTags(resource.tag)
  @ApiBearerAuth('bearerAuth')
  @ApiExtraModels(resource.entity)
  @ApiForbiddenResponse({
    description: 'Missing, invalid, or unauthorized role.',
  })
  @Roles(...(resource.readRoles ?? []))
  @UseGuards(RolesGuard)
  @Controller(resource.path)
  class UrbanityResourceController {
    constructor(
      @Inject(serviceToken(resource.name))
      private readonly service: CrudService<any, any, any>,
    ) {}

    @Get()
    @ApiOperation({
      summary: `List all ${resource.label.toLowerCase()} records`,
    })
    @ApiOkResponse({
      description: `${resource.label} records returned successfully.`,
      schema: responseSchema(resource.entity, true),
    })
    findAll(): ApiResponse<unknown[]> {
      return apiResponse(this.sanitize(this.service.findAll()) as unknown[]);
    }

    @Get(':id')
    @ApiOperation({ summary: `Get ${resource.label.toLowerCase()} by id` })
    @ApiOkResponse({
      description: `${resource.label} returned successfully.`,
      schema: responseSchema(resource.entity),
    })
    @ApiBadRequestResponse({ description: `Invalid ${resource.label} id.` })
    @ApiNotFoundResponse({ description: `${resource.label} not found.` })
    findById(
      @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    ): ApiResponse<unknown> {
      return apiResponse(this.sanitize(this.service.findById(id)));
    }

    @Post()
    @ApiOperation({ summary: `Create ${resource.label.toLowerCase()}` })
    @ApiBody({ type: resource.createDto })
    @ApiCreatedResponse({
      description: `${resource.label} created successfully.`,
      schema: responseSchema(resource.entity),
    })
    @ApiBadRequestResponse({ description: 'Invalid request body.' })
    create(
      @Body(new ValidationPipe({ expectedType: resource.createDto }))
      createDto: unknown,
    ): ApiResponse<unknown> {
      return apiResponse(
        this.sanitize(this.service.create(this.prepareInput(createDto))),
      );
    }

    @Patch(':id')
    @ApiOperation({
      summary: `Partially update ${resource.label.toLowerCase()}`,
    })
    @ApiBody({ type: resource.updateDto })
    @ApiOkResponse({
      description: `${resource.label} updated successfully.`,
      schema: responseSchema(resource.entity),
    })
    @ApiBadRequestResponse({
      description: `Invalid ${resource.label} id or request body.`,
    })
    @ApiNotFoundResponse({ description: `${resource.label} not found.` })
    patch(
      @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
      @Body(new ValidationPipe({ expectedType: resource.updateDto }))
      updateDto: unknown,
    ): ApiResponse<unknown> {
      return apiResponse(
        this.sanitize(this.service.update(id, this.prepareInput(updateDto, this.service.findById(id))),
        ),
      );
    }

    @Delete(':id')
    @ApiOperation({ summary: `Delete ${resource.label.toLowerCase()}` })
    @ApiOkResponse({
      description: `${resource.label} deleted successfully.`,
      schema: responseSchema(resource.entity),
    })
    @ApiBadRequestResponse({ description: `Invalid ${resource.label} id.` })
    @ApiNotFoundResponse({ description: `${resource.label} not found.` })
    delete(
      @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    ): ApiResponse<unknown> {
      return apiResponse(this.sanitize(this.service.delete(id)));
    }

    private sanitize(data: unknown): unknown {
      if (resource.name !== 'users') return data;
      const sanitizeUser = (user: Record<string, unknown>) => {
        const { passwordHash: _passwordHash, ...safeUser } = user;
        return safeUser;
      };

      return Array.isArray(data)
        ? data.map(sanitizeUser)
        : sanitizeUser(data as Record<string, unknown>);
    }

    private prepareInput(data: unknown, existing?: Record<string, unknown>): unknown {
      if (resource.name !== 'users') return data;

      const { password, ...userData } = data as Record<string, unknown>;
      const prepared = typeof password === 'string'
        ? { ...userData, passwordHash: hashSync(password, 10) }
        : userData;
      this.validateUserAssociations({ ...existing, ...prepared });
      return prepared;
    }

    private validateUserAssociations(user: Record<string, unknown>): void {
      const role = user.role as RoleName | undefined;
      const has = (field: 'communityId' | 'towerId' | 'apartmentId') => Boolean(user[field]);

      if (!role) throw new BadRequestException('A user role is required');
      if (role === RoleName.SuperAdmin) {
        if (has('communityId') || has('towerId') || has('apartmentId')) throw new BadRequestException('SUPER_ADMIN accounts cannot have community, tower, or apartment associations');
        return;
      }
      if (role === RoleName.CommunityAdmin || role === RoleName.MaintenanceWorker) {
        if (!has('communityId')) throw new BadRequestException(`${role} accounts require a community association`);
        if (has('towerId') || has('apartmentId')) throw new BadRequestException(`${role} accounts cannot have tower or apartment associations`);
        return;
      }
      if (role === RoleName.TowerRepresentative && (has('communityId') || has('apartmentId'))) throw new BadRequestException('TOWER_REPRESENTATIVE accounts use only a tower association');
      if (role === RoleName.Resident && (has('communityId') || has('towerId'))) throw new BadRequestException('RESIDENT accounts use only an apartment association');
    }
  }

  Object.defineProperty(UrbanityResourceController, 'name', {
    value: `${resource.label.replace(/\s+/g, '')}Controller`,
  });

  return UrbanityResourceController;
}

const responseSchema = (model: Type<unknown>, isArray = false) => ({
  type: 'object',
  properties: {
    success: { type: 'boolean', example: true },
    data: isArray
      ? {
          type: 'array',
          items: { $ref: getSchemaPath(model) },
        }
      : { $ref: getSchemaPath(model) },
  },
});
