import { Request, Response } from "express";
import { broadcastStateToAllNodes } from "../utils/functions";
import { GlobalVarType, NodeVarType, ReceivedObjectType } from "../utils/types";

export const postIndexRoute = (
  req: Request,
  res: Response,
  nodeVar: NodeVarType,
  isFaulty: boolean,
  receivedObject: ReceivedObjectType,
  N: number,
  F: number,
  globalVar: GlobalVarType,
  logs: Array<string>,
  goToNextRound: () => void
) => {
  // req.body: {nodeIndex: number, round: number, tag: TagType, value: ValueType}

  if (isFaulty) {
    res.status(500).send("Node is faulty");
    return;
  }

  if (nodeVar.decision !== undefined) {
    return;
  }

  if (req.body.tag === "R") {
    // if receivedObject.R is too small (round object doesn't exist), create it
    const lengthDiff = req.body.round - receivedObject.R.length;
    for (let index = 0; index < lengthDiff; index++) {
      receivedObject.R.push({
        receivedCount: 0,
        receivedOnes: 0,
        receivedZeros: 0,
      });
    }

    receivedObject.R[req.body.round - 1].receivedCount += 1;
    if (req.body.state === 1) {
      receivedObject.R[req.body.round - 1].receivedOnes += 1;
    } else {
      receivedObject.R[req.body.round - 1].receivedZeros += 1;
    }

    // console.log(
    //   `<-- Received tag=R from Node #${
    //     req.body.nodeIndex
    //   } to Node #${nodeVar.index} in round=${req.body.round} with value=${
    //     req.body.state
    //   }, count is ${receivedObject.R[req.body.round - 1].receivedCount}`
    // );

    // take decision if count is greater than N - F
    if (receivedObject.R[req.body.round - 1].receivedCount >= N - F) {
      logs.push(
        `RECEIVED_ENOUGH_R_MESSAGES-r${nodeVar.round}-s${globalVar.step}-#${
          nodeVar.index
        }-${JSON.stringify(receivedObject.R[req.body.round - 1])}`
      );
      if (receivedObject.R[req.body.round - 1].receivedOnes > N / 2) {
        broadcastStateToAllNodes(
          1,
          nodeVar.index,
          "P",
          nodeVar.round,
          N,
          F,
          globalVar,
          logs
        );
      } else if (receivedObject.R[req.body.round - 1].receivedZeros > N / 2) {
        broadcastStateToAllNodes(
          0,
          nodeVar.index,
          "P",
          nodeVar.round,
          N,
          F,
          globalVar,
          logs
        );
      } else {
        broadcastStateToAllNodes(
          -1,
          nodeVar.index,
          "P",
          nodeVar.round,
          N,
          F,
          globalVar,
          logs
        );
      }
    }
  } else if (req.body.tag === "P") {
    // console.log("P", receivedObject.P, req.body.round);

    // if receivedObject.P is too small (round object doesn't exist), create it
    const lengthDiff = req.body.round - receivedObject.P.length;
    for (let index = 0; index < lengthDiff; index++) {
      receivedObject.P.push({
        receivedCount: 0,
        receivedOnes: 0,
        receivedZeros: 0,
        receivedMinusOnes: 0,
      });
    }

    receivedObject.P[req.body.round - 1].receivedCount += 1;
    if (req.body.state === 1) {
      receivedObject.P[req.body.round - 1].receivedOnes += 1;
    } else if (req.body.state === 0) {
      receivedObject.P[req.body.round - 1].receivedZeros += 1;
    } else if (req.body.state === -1) {
      receivedObject.P[req.body.round - 1].receivedMinusOnes += 1;
    } else {
      throw new Error(`value error - ${req.body.state}`);
    }

    // take decision if condition is met
    if (receivedObject.P[req.body.round - 1].receivedCount >= N - F) {
      logs.push(
        `RECEIVED_ENOUGH_P_MESSAGES-r${nodeVar.round}-s${globalVar.step}-#${
          nodeVar.index
        }-${JSON.stringify(receivedObject.P[req.body.round - 1])}`
      );
      globalVar.step += 1;
      if (receivedObject.P[req.body.round - 1].receivedOnes >= F + 1) {
        // decide 1
        console.log(`DECISION - ${nodeVar.index} - 1`);
        nodeVar.decision = 1;
        logs.push(
          `DECISION_r${nodeVar.round}_s${globalVar.step + 1}-#${
            nodeVar.index
          }-1`
        );
        globalVar.step += 1;
      } else if (receivedObject.P[req.body.round - 1].receivedZeros >= F + 1) {
        // decide 0
        console.log(`DECISION - ${nodeVar.index} - 0`);
        nodeVar.decision = 0;
        logs.push(
          `DECISION_r${nodeVar.round}_s${globalVar.step + 1}-#${
            nodeVar.index
          }-0`
        );
        globalVar.step += 1;
      } else if (receivedObject.P[req.body.round - 1].receivedOnes > 0) {
        nodeVar.state = 1;
        goToNextRound();
        logs.push(
          `CHANGE_STATE_r${nodeVar.round}_s${globalVar.step + 1}-#${
            nodeVar.index
          }-1`
        );
        globalVar.step += 1;
      } else if (receivedObject.P[req.body.round - 1].receivedZeros > 0) {
        nodeVar.state = 0;
        goToNextRound();
        logs.push(
          `CHANGE_STATE_r${nodeVar.round}_s${globalVar.step + 1}-#${
            nodeVar.index
          }-0`
        );
        globalVar.step += 1;
      } else {
        nodeVar.state = Math.floor((Math.random() * 100) % 2) === 0 ? 0 : 1;
        goToNextRound();
        logs.push(
          `CHANGE_RND_STATE_r${nodeVar.round}_s${globalVar.step + 1}-#${
            nodeVar.index
          }-s${nodeVar.state}`
        );
        globalVar.step += 1;
      }
    }
  } else {
    throw new Error(`tag error ${req.body.tag}`);
  }
};
