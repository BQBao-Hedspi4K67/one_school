import {
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsString,
  IsUrl,
  MaxLength,
  ArrayMaxSize,
  MinLength,
} from 'class-validator';

export class CreateArticleDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  category!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(160)
  title!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  description!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  content!: string;

  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_tld: false })
  coverImageUrl?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsUrl({ protocols: ['http', 'https'], require_tld: false }, { each: true })
  imageUrls?: string[];
}
