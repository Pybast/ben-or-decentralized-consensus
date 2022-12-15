import express, { Request, Response } from "express";
import fetch from "node-fetch";
import fs from "fs";
import {
  broadcastStateToAllNodes,
  isReady,
  sendIsReadyToAllNodes,
  setFaultyNodes,
} from "./utils/functions";
import {
  GlobalVarType,
  NodeVarType,
  ReceivedObjectType,
  StateType,
} from "./utils/types";
import { getIndexRoute } from "./route/getIndexRoute";
import { postReady } from "./route/postReady";
import { postIndexRoute } from "./route/postIndexRoute";

const logs: Array<string> = [];

let globalVar: GlobalVarType = {
  step: 0,
};

const launchNode = async (
  nodeIndex: number,
  initialState: StateType,
  isFaulty: boolean,
  port: number,
  N: number,
  F: number,
  runIdentifier: string
) => {
  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json());

  const nodeVar: NodeVarType = {
    index: nodeIndex,
    decision: undefined,
    state: initialState,
    round: 1,
  };

  const readyStates = Array(N).fill(false);
  let broadcastedInitialMessages = false;

  const goToNextRound = () => {
    nodeVar.round += 1;
    broadcastedInitialMessages = false;
  };

  app.get("/", (req: Request, res: Response) => {
    getIndexRoute(req, res, isFaulty);
  });

  // start the consensus once all nodes are ready
  app.post("/ready", (req: Request, res: Response) => {
    postReady(req, res, readyStates, nodeIndex, N);
  });

  app.get("/ready", (req: Request, res: Response) => {
    res.send(`Status - ${isReady(readyStates) ? "ready" : "not ready"}`);
  });

  app.get("/finished", (req: Request, res: Response) => {
    return res
      .status(200)
      .json({ finished: nodeVar.decision !== undefined || isFaulty });
  });

  // ROUTE WHERE MESSAGES ARE RECEIVED

  const receivedObject: ReceivedObjectType = {
    P: [],
    R: [],
  };

  app.post("/", (req: Request, res: Response) => {
    postIndexRoute(
      req,
      res,
      nodeVar,
      isFaulty,
      receivedObject,
      N,
      F,
      globalVar,
      logs,
      goToNextRound
    );
  });

  app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
    sendIsReadyToAllNodes(nodeVar.index, N);

    if (!isFaulty) {
      logs.push(
        `INITSTATE_r${nodeVar.round}_s${globalVar.step + 1}-#${
          nodeVar.index
        }-s${nodeVar.state}`
      );
      globalVar.step += 1;
      setInterval(() => {
        iterateBenOr();
      }, 100);
    } else {
      logs.push(
        `FAULTY_r${nodeVar.round}_s${globalVar.step + 1}-#${nodeVar.index}`
      );
      globalVar.step += 1;
    }
  });

  const iterateBenOr = () => {
    // 1st step - wait for nodes to be ready
    if (!isReady(readyStates)) return;

    // 2nd step - broadcast to all nodes
    if (!broadcastedInitialMessages) {
      broadcastedInitialMessages = true;
      broadcastStateToAllNodes(
        nodeVar.state,
        nodeVar.index,
        "R",
        nodeVar.round,
        N,
        F,
        globalVar,
        logs
      );
      return;
    }

    return;
  };
};

const launchMultipleNodes = async (
  N: number,
  F: number,
  initialState: Array<StateType>,
  runIdentifier: string
) => {
  if (F >= N / 2) {
    throw new Error(
      `The Ben-or decentralized consensus algorithm needs to have at least half of his processes running - got ${Math.floor(
        (100 * F) / N
      )}% faulty processes`
    );
  }
  if (initialState.length !== N) {
    throw new Error("initial states length doesn't match number of nodes");
  }

  // determines faulty indexes
  let nodeIsFaultyArray = Array(N).fill(false);
  setFaultyNodes(nodeIsFaultyArray, F);
  console.log(nodeIsFaultyArray);

  for (let index = 0; index < N; index++) {
    // if faulty index => faulty
    if (nodeIsFaultyArray[index]) {
      console.log(`Node ${index} is faulty`);
    }
    launchNode(
      index,
      initialState[index],
      nodeIsFaultyArray[index],
      3000 + index,
      N,
      F,
      runIdentifier
    );
  }

  // save logs if nodes are done
  let saved = false;
  setInterval(async () => {
    if (saved) return;

    for (let index = 0; index < N; index++) {
      const hasFinished = await fetch(
        `http://localhost:${3000 + index}/finished`
      )
        .then((res) => res.json())
        .then((json) => json.finished);

      console.log("finished", hasFinished);

      if (!hasFinished) return;
    }
    saved = true;
    fs.writeFile(
      `logs/${runIdentifier}_logs.logs`,
      logs.join("\n"),
      function (err) {
        if (err) return console.log(err);
        console.log(
          `FINISHED - logs saved in /logs/${runIdentifier}_logs.logs`
        );
      }
    );
  }, 500);
};

const initialState: Array<StateType> = [1, 1, 1, 0, 0];

const runIdentifier = new Date().getTime().toString();

launchMultipleNodes(initialState.length, 2, initialState, runIdentifier);
