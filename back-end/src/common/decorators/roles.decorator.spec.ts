import { describe, expect, it } from '@jest/globals';
import { RoleName } from '../enums/roles.enum';
import { ROLES_KEY, Roles } from './roles.decorator';

describe('Roles decorator', () => {
  it('stores only final application roles as metadata', () => {
    class ExampleController {
      @Roles(RoleName.CommunityAdmin, RoleName.TowerRepresentative)
      action() {}
    }

    expect(Reflect.getMetadata(ROLES_KEY, ExampleController.prototype.action)).toEqual([
      RoleName.CommunityAdmin,
      RoleName.TowerRepresentative,
    ]);
  });
});
