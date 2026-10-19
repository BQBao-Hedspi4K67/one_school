import { ArrayMaxSize, IsArray, IsOptional, IsString, IsUrl, MaxLength, MinLength } from 'class-validator';

export class SaveConnectGroupDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;
}

export class ConnectPostDto {
  @IsString()
  @MinLength(1)
  @MaxLength(3000)
  body!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  imageUrl?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsUrl({ protocols: ['http', 'https'], require_tld: false }, { each: true })
  imageUrls?: string[];
}

export class ConnectCommentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  body!: string;

  @IsOptional()
  @IsString()
  parentId?: string;
}
