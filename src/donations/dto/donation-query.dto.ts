import { IsOptional, IsEnum, IsDateString, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../common/dto/pagination.dto';

export enum DonationType {
  DIRECT = 'DIRECT',
  POT = 'POT',
  POT_PROJECT = 'POT_PROJECT',
  CAMPAIGN = 'CAMPAIGN',
}

export class DonationQueryDto extends PaginationDto {
  @IsOptional()
  @IsEnum(DonationType)
  type?: DonationType;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minAmount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxAmount?: number;

  @IsOptional()
  sort?: string;
}
