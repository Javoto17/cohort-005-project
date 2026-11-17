export type StandardRule =
  | "intent-literal"
  | "inline-object-type"
  | "one-component-per-file"
  | "component-location";

export type StandardViolation = {
  file: string;
  line: number;
  rule: StandardRule;
  fingerprint: string;
  message: string;
};

export type StandardsBaseline = Record<string, number>;
