import { Injectable } from '@nestjs/common';

export interface User {
  id: number;
  name: string;
  email: string;
  role: string;
}

@Injectable()
export class UsersService {
  private readonly users: User[] = [
    { id: 1, name: 'Alice Johnson', email: 'alice@example.com', role: 'Admin' },
    { id: 2, name: 'Bob Smith', email: 'bob@example.com', role: 'Editor' },
    { id: 3, name: 'Carol Williams', email: 'carol@example.com', role: 'Viewer' },
    { id: 4, name: 'David Brown', email: 'david@example.com', role: 'Editor' },
    { id: 5, name: 'Eve Davis', email: 'eve@example.com', role: 'Viewer' },
  ];

  findAll(): User[] {
    return this.users;
  }
}
