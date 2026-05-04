import {
  Body,
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
import { apiResponse } from '../api-response';
import type { ApiResponse } from '../api-response';
import { RolesGuard } from '../guards/roles.guard';
import { CrudService } from './crud.service';
import { ResourceDefinition, serviceToken } from '../../data/urbanity.resources';

export function createUrbanityController(resource: ResourceDefinition): Type {
  @ApiTags(resource.tag)
  @ApiExtraModels(resource.entity)
  @ApiForbiddenResponse({
    description: 'Missing, invalid, or unauthorized role.',
  })
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
      return apiResponse(this.service.findAll());
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
      return apiResponse(this.service.findById(id));
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
      return apiResponse(this.service.create(createDto));
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
      return apiResponse(this.service.update(id, updateDto));
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
      return apiResponse(this.service.delete(id));
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
