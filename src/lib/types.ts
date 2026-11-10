// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Row = Record<string, any>;

export type Estado = {
  ok?: boolean;
  error?: string;
  info?: string;
  duplicate?: boolean;
};
