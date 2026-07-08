export interface Repository<TSummary> {
  list(): Promise<TSummary[]>;
}
