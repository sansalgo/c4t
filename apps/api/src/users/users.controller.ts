import { Controller, Get, Param } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.interface';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get(':id')
  findOne(@CurrentUser() _user: AuthenticatedUser, @Param('id') id: string) {
    // Any authenticated user can look up by id for now.
    // Scope tighter in M9 if needed.
    return this.usersService.findOne(id);
  }
}
