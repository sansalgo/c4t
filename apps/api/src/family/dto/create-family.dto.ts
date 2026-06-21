import { IsString, MinLength } from 'class-validator';

export class CreateFamilyDto {
  @IsString()
  @MinLength(1)
  name!: string;

  // TODO M2: remove — creator will come from the session
  @IsString()
  creatorUserId!: string;
}
