import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';

export interface Identifiable {
  id: string;
}

@Injectable()
export class CrudRepository<T extends Identifiable> {
  private readonly items: T[];

  constructor(initialItems: T[] = []) {
    this.items = [...initialItems];
  }

  findAll(): T[] {
    return [...this.items];
  }

  findById(id: string): T | undefined {
    return this.items.find((item) => item.id === id);
  }

  create(data: Omit<T, 'id'>): T {
    const item = {
      id: randomUUID(),
      ...data,
    } as T;

    this.items.push(item);
    return item;
  }

  update(id: string, data: Partial<Omit<T, 'id'>>): T | undefined {
    const item = this.findById(id);

    if (!item) {
      return undefined;
    }

    Object.assign(item, data);
    return item;
  }

  delete(id: string): T | undefined {
    const itemIndex = this.items.findIndex((item) => item.id === id);

    if (itemIndex === -1) {
      return undefined;
    }

    const [deletedItem] = this.items.splice(itemIndex, 1);
    return deletedItem;
  }
}
