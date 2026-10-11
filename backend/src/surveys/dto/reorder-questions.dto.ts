import { ArrayMinSize, IsArray, IsString } from 'class-validator';

export class ReorderQuestionsDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  questionIds!: string[];
}
