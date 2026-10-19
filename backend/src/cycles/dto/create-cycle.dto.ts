import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class CreateCycleDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  title!: string;
}
