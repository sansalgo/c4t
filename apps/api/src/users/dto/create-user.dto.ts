import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsString()
  @MinLength(1)
  displayName!: string;
}
