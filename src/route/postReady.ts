import { Request, Response } from "express";
import { isReady, sendIsReadyToAllNodes } from "../utils/functions";

export const postReady = (
  req: Request,
  res: Response,
  readyStates: Array<boolean>,
  nodeIndex: number,
  N: number
) => {
  // faulty nodes can still say they are ready
  if (isReady(readyStates)) {
    return;
  }

  if (
    typeof req.body.nodeIndex !== "number" ||
    req.body.nodeIndex < 0 ||
    req.body.nodeIndex >= N
  ) {
    throw new Error(`Wrong req body - ${req.body.nodeIndex}`);
  }

  readyStates[req.body.nodeIndex] = true;
  sendIsReadyToAllNodes(nodeIndex, N);

  res.status(200).send();
};
