import { IsDateString, IsOptional } from 'class-validator';

// Only endAt is editable after creation — changing the rule or template fields
// would silently alter future instances in confusing ways.
export class UpdateRecurrenceRuleDto {
  @IsDateString()
  @IsOptional()
  endAt?: string;
}
