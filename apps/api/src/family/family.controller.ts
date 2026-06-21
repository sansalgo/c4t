import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CreateFamilyDto } from './dto/create-family.dto';
import { FamilyService } from './family.service';

@Controller('families')
export class FamilyController {
  constructor(private readonly familyService: FamilyService) {}

  // TODO M2: guard with session auth — only authenticated users can create a family
  @Post()
  create(@Body() dto: CreateFamilyDto) {
    return this.familyService.create(dto);
  }

  // TODO M2: guard — only family members can view family details
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.familyService.findOne(id);
  }
}
