import { plainToInstance, Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
  validateSync,
} from 'class-validator';

class EnvironmentVariables {
  @IsUrl({ protocols: ['postgresql', 'postgres'], require_tld: false })
  @IsNotEmpty()
  DATABASE_URL!: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  @IsOptional()
  @Type(() => Number)
  PORT = 3000;

  @IsString()
  @IsNotEmpty()
  FRONTEND_URL = 'http://127.0.0.1:5173,http://localhost:5173';

  @IsString()
  @IsNotEmpty()
  JWT_ACCESS_SECRET!: string;

  @IsString()
  @IsNotEmpty()
  JWT_REFRESH_SECRET!: string;

  @IsString()
  @IsOptional()
  JWT_ACCESS_EXPIRES_IN = '15m';

  @IsString()
  @IsOptional()
  JWT_REFRESH_EXPIRES_IN = '7d';

  @IsString()
  @IsOptional()
  COOKIE_SECURE = 'true';

  @IsUrl({ protocols: ['http', 'https'], require_tld: false })
  @IsOptional()
  AI_API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai';

  @IsString()
  @IsOptional()
  AI_MODEL = 'gemma-4-26b-a4b-it';

  @IsString()
  @IsOptional()
  AI_API_KEY = '';

  @IsString()
  @IsOptional()
  CLOUDINARY_CLOUD_NAME = '';

  @IsString()
  @IsOptional()
  CLOUDINARY_API_KEY = '';

  @IsString()
  @IsOptional()
  CLOUDINARY_API_SECRET = '';
}

export function validateEnvironment(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }
  const origins = validatedConfig.FRONTEND_URL.split(',').map((origin) =>
    origin.trim(),
  );
  if (
    origins.some((origin) => {
      try {
        const url = new URL(origin);
        return !['http:', 'https:'].includes(url.protocol);
      } catch {
        return true;
      }
    })
  ) {
    throw new Error(
      'FRONTEND_URL must contain one or more valid HTTP(S) origins separated by commas',
    );
  }

  return validatedConfig;
}
