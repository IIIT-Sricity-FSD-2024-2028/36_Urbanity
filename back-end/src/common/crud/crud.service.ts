import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CrudRepository, Identifiable } from './crud.repository';

@Injectable()
export class CrudService<
  T extends Identifiable,
  C extends Partial<Omit<T, 'id'>>,
  U extends Partial<Omit<T, 'id'>>,
> {
  constructor(
    private readonly repository: CrudRepository<T>,
    private readonly resourceLabel: string,
    private readonly defaultFactory: () => Partial<Omit<T, 'id'>> = () => ({}),
  ) {}

  findAll(): T[] {
    return this.repository.findAll();
  }

  findById(id: string): T {
    const item = this.repository.findById(id);

    if (!item) {
      throw new NotFoundException(
        `${this.resourceLabel} with id "${id}" was not found`,
      );
    }

    return item;
  }

  create(createDto: C): T {
    return this.repository.create({
      ...this.defaultFactory(),
      ...createDto,
    } as Omit<T, 'id'>);
  }

  update(id: string, updateDto: U): T {
    if (Object.keys(updateDto).length === 0) {
      throw new BadRequestException('At least one field must be provided');
    }

    const item = this.repository.update(id, updateDto);

    if (!item) {
      throw new NotFoundException(
        `${this.resourceLabel} with id "${id}" was not found`,
      );
    }

    return item;
  }

  delete(id: string): T {
    const item = this.repository.delete(id);

    if (!item) {
      throw new NotFoundException(
        `${this.resourceLabel} with id "${id}" was not found`,
      );
    }

    return item;
  }
}
