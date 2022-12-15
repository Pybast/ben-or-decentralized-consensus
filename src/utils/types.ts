export type TagType = "R" | "P";

export type StateType = -1 | 0 | 1;

export type ReceivedObjectType = {
  R: Array<{
    receivedCount: number;
    receivedOnes: number;
    receivedZeros: number;
  }>;
  P: Array<{
    receivedCount: number;
    receivedOnes: number;
    receivedZeros: number;
    receivedMinusOnes: number;
  }>;
};

export type NodeVarType = {
  index: number;
  decision: number | undefined;
  state: StateType;
  round: number;
};

export type GlobalVarType = {
  step: number;
};
