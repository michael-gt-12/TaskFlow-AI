export interface Job {
  name: string;
  run(): Promise<void>;
}
