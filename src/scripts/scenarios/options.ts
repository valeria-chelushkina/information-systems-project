export interface ScenarioOptions {
  name: string;
  rate: number;
  duration: number;
  quantity: number;
  seats: number;
  buyers: number;
  count: number;
  ticketingUrl: string;
  catalogUrl: string;
  annotate: boolean;
}

function argValue(argv: string[], name: string): string | undefined {
  const prefix = `--${name}=`;
  return argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function argNumber(argv: string[], name: string, fallback: number): number {
  const raw = argValue(argv, name);
  return raw === undefined ? fallback : Number(raw);
}

export function parseOptions(argv: string[]): ScenarioOptions {
  const options: ScenarioOptions = {
    name: argValue(argv, 'name') ?? 'browse',
    rate: argNumber(argv, 'rate', 5),
    duration: argNumber(argv, 'duration', 30),
    quantity: argNumber(argv, 'quantity', 1),
    seats: argNumber(argv, 'seats', 5),
    buyers: argNumber(argv, 'buyers', 50),
    count: argNumber(argv, 'count', 5),
    ticketingUrl: argValue(argv, 'ticketing-url') ?? 'http://127.0.0.1:3001',
    catalogUrl: argValue(argv, 'catalog-url') ?? 'http://127.0.0.1:3003',
    annotate: argv.includes('--annotate'),
  };

  if (!Number.isFinite(options.rate) || options.rate <= 0) {
    throw new Error('--rate must be a positive number');
  }
  if (!Number.isFinite(options.duration) || options.duration <= 0) {
    throw new Error('--duration must be a positive number');
  }

  return options;
}
