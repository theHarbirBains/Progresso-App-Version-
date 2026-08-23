export interface EnvironmentVariables {
  NODE_ENV: 'development' | 'production' | 'test';
  PORT: number;
  HOST: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  CORS_ORIGIN: string;
}

const NODE_ENVS: EnvironmentVariables['NODE_ENV'][] = ['development', 'production', 'test'];

export function validate(config: Record<string, unknown>): EnvironmentVariables {
  const nodeEnv = (config.NODE_ENV as string) || 'development';
  if (!NODE_ENVS.includes(nodeEnv as EnvironmentVariables['NODE_ENV'])) {
    throw new Error(`Invalid NODE_ENV "${nodeEnv}". Expected one of: ${NODE_ENVS.join(', ')}`);
  }

  for (const key of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'] as const) {
    if (!config[key] || typeof config[key] !== 'string') {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }

  const port = Number(config.PORT ?? 4000);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`Invalid PORT "${String(config.PORT)}". Expected a positive integer.`);
  }

  return {
    NODE_ENV: nodeEnv as EnvironmentVariables['NODE_ENV'],
    PORT: port,
    HOST: (config.HOST as string) || '0.0.0.0',
    SUPABASE_URL: config.SUPABASE_URL as string,
    SUPABASE_SERVICE_ROLE_KEY: config.SUPABASE_SERVICE_ROLE_KEY as string,
    CORS_ORIGIN: (config.CORS_ORIGIN as string) || '*',
  };
}
