import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateChildDto {
  @IsString()
  @MinLength(1)
  displayName!: string;

  @IsEmail()
  @IsOptional()
  email?: string;
}
