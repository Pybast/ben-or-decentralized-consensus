import fetch from "node-fetch";
import { GlobalVarType, StateType, TagType } from "./types";

export const broadcastStateToAllNodes = (
  state: StateType,
  currentNodeIndex: number,
  tag: TagType,
  round: number,
  N: number,
  F: number,
  globalVar: GlobalVarType,
  logs: Array<string>
) => {
  // console.log(
  //   `Broadcasting state=${state} from node #${currentNodeIndex} to all nodes with tag=${tag}`
  // );

  for (let index = 0; index < N; index++) {
    // if (index === currentNodeIndex) continue;
    // console.log(
    //   `--> Sending request from node #${currentNodeIndex} to node #${index}`
    // );
    logs.push(
      `BROADCAST_MESSAGE-r${round}-s${globalVar.step}-from#${currentNodeIndex}-to#${index}-t${tag}-s${state}`
    );
    globalVar.step += 1;

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

export const sendIsReadyToAllNodes = async (
  currentNodeIndex: number,
  N: number
) => {
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

export const isReady = (readyStates: Array<boolean>) => {
  return readyStates.reduce((prev: boolean, curr: boolean) => prev && curr);
};

// make a total of _f nodes faulty (true)
export const setFaultyNodes = (
  _nodeIsFaultyArray: Array<boolean>,
  _f: number
) => {
  for (let index = 0; index < _f; index++) {
    let randomIndex =
      Math.floor(Math.random() * 1000) % _nodeIsFaultyArray.length;
    while (_nodeIsFaultyArray[randomIndex] === true) {
      randomIndex =
        Math.floor(Math.random() * 1000) % _nodeIsFaultyArray.length;
    }
    _nodeIsFaultyArray[randomIndex] = true;
  }
};
