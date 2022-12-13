import express, { Request, Response } from "express";
import fetch from "node-fetch";

type TagType = "R" | "P";
type StateType = -1 | 0 | 1;

const broadcastStateToAllNodes = (
  state: StateType,
  currentNodeIndex: number,
  tag: TagType,
  round: number,
  N: number,
  F: number
) => {
  for (let index = 0; index < N; index++) {
    if (index === currentNodeIndex) continue;

    fetch(`http://localhost:${3000 + index}/`, {
      method: "POST",
      body: JSON.stringify({
        nodeIndex: currentNodeIndex,
        tag: tag,
        round: round,
        state: state,
      }),
      headers: { "Content-Type": "application/json" },
    });
  }
};

const sendIsReadyToAllNodes = async (currentNodeIndex: number, N: number) => {
  for (let index = 0; index < N; index++) {
    await fetch(`http://localhost:${3000 + index}/ready`, {
      method: "POST",
      body: JSON.stringify({
        nodeIndex: currentNodeIndex,
      }),
      headers: { "Content-Type": "application/json" },
    });
  }
};

const isReady = (readyStates: Array<boolean>) => {
  return readyStates.reduce((prev: boolean, curr: boolean) => prev && curr);
};

const launchNode = async (
  nodeIndex: number,
  initialState: StateType,
  port: number,
  N: number,
  F: number
) => {
  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json());

  let state = initialState;
  let round = 1;

  const readyStates = Array(N).fill(false);
  let broadcastedInitialMessages = false;
  let hasReceivedEnoughMessages = false;

  app.get("/", (req: Request, res: Response) => {
    res.send("Hello World!");
  });

  // start the consensus once all nodes are ready
  app.post("/ready", (req: Request, res: Response) => {
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
    if (isReady(readyStates)) {
      console.log("all nodes are ready");

      // START BEN OR ALGORITHM
      // startBenOr(initialState, { index: nodeIndex }, N, F);
    }

    sendIsReadyToAllNodes(nodeIndex, N);

    res.status(200).send();
  });

  app.get("/ready", (req: Request, res: Response) => {
    res.send(`Status - ${isReady(readyStates) ? "ready" : "not ready"}`);
  });

  // ROUTE WHERE MESSAGES ARE RECEIVED

  // need to have a better data structure to take into consideration
  // future rounds if certain nodes are faster
  let receivedRCount = 0;
  let receivedRValue = 0;

  let receivedPCount = 0;
  let receivedPOne = 0;
  let receivedPZero = 0;
  let receivedPMinusOne = 0;

  app.post("/", (req: Request, res: Response) => {
    if (req.body.tag === "R") {
      receivedRCount += 1;
      if (req.body.state === 1) {
        receivedRValue += 1;
      } else {
        receivedRValue -= 1;
      }

      // take decision if count is greater than N - F
      if (receivedRCount >= N - F) {
        if (receivedRValue !== 0) {
          const v = receivedRValue < 0 ? 0 : 1;
          broadcastStateToAllNodes(v, nodeIndex, "P", round, N, F);
        } else {
          broadcastStateToAllNodes(-1, nodeIndex, "P", round, N, F);
        }
      }
    } else if (req.body.tag === "P") {
      receivedPCount += 1;
      if (req.body.state === 1) {
        receivedPOne += 1;
      } else if (req.body.state === 0) {
        receivedPZero += 1;
      } else if (req.body.state === -1) {
        receivedPMinusOne += 1;
      } else {
        throw new Error(`value error - ${req.body.state}`);
      }

      // take decision if condition is met
      if (receivedPCount >= N - F) {
        if (receivedPOne > F + 1) {
          // decide 1
          console.log(`DECISION - ${nodeIndex} - 1`);
        } else if (receivedPZero > F + 1) {
          // decide 0
          console.log(`DECISION - ${nodeIndex} - 0`);
        } else if (receivedPOne > 0) {
          state = 1;
        } else if (receivedPZero > 0) {
          state = 0;
        } else {
          state = Math.floor((Math.random() * 100) % 2) === 0 ? 0 : 1;
        }
      }
    } else {
      throw new Error(`tag error ${req.body.tag}`);
    }
  });

  app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
    sendIsReadyToAllNodes(nodeIndex, N);

    setInterval(() => {
      iterateBenOr();
    }, 100);
  });

  const iterateBenOr = () => {
    // 1st step - wait for nodes to be ready
    if (!isReady(readyStates)) return;

    // 2nd step - broadcast to all nodes
    if (!broadcastedInitialMessages) {
      broadcastedInitialMessages = true;
      broadcastStateToAllNodes(state, nodeIndex, "R", round, N, F);
      return;
    }

    return;
  };
};

const launchMultipleNodes = async (
  N: number,
  F: number,
  initialState: Array<StateType>
) => {
  if (initialState.length !== N) {
    throw new Error("initial states length doesn't match number of nodes");
  }

  // determines faulty indexes

  for (let index = 0; index < N; index++) {
    // if faulty index => faulty

    launchNode(index, initialState[index], 3000 + index, N, F);
  }

  // launch consensus watcher
};

const initialState: Array<StateType> = [1, 0, 0];

launchMultipleNodes(3, 1, initialState);
