"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const node_fetch_1 = __importDefault(require("node-fetch"));
const fs_1 = __importDefault(require("fs"));
const logs = [];
let step = 0;
const broadcastStateToAllNodes = (state, currentNodeIndex, tag, round, N, F) => {
    // console.log(
    //   `Broadcasting state=${state} from node #${currentNodeIndex} to all nodes with tag=${tag}`
    // );
    for (let index = 0; index < N; index++) {
        // if (index === currentNodeIndex) continue;
        // console.log(
        //   `--> Sending request from node #${currentNodeIndex} to node #${index}`
        // );
        logs.push(`BROADCAST_MESSAGE-r${round}-s${step}-from#${currentNodeIndex}-to#${index}-t${tag}-s${state}`);
        step++;
        (0, node_fetch_1.default)(`http://localhost:${3000 + index}/`, {
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
const sendIsReadyToAllNodes = (currentNodeIndex, N) => __awaiter(void 0, void 0, void 0, function* () {
    for (let index = 0; index < N; index++) {
        yield (0, node_fetch_1.default)(`http://localhost:${3000 + index}/ready`, {
            method: "POST",
            body: JSON.stringify({
                nodeIndex: currentNodeIndex,
            }),
            headers: { "Content-Type": "application/json" },
        });
    }
});
const isReady = (readyStates) => {
    return readyStates.reduce((prev, curr) => prev && curr);
};
// make a total of _f nodes faulty (true)
const setFaultyNodes = (_nodeIsFaultyArray, _f) => {
    for (let index = 0; index < _f; index++) {
        let randomIndex = Math.floor(Math.random() * 1000) % _nodeIsFaultyArray.length;
        while (_nodeIsFaultyArray[randomIndex] === true) {
            randomIndex =
                Math.floor(Math.random() * 1000) % _nodeIsFaultyArray.length;
        }
        _nodeIsFaultyArray[randomIndex] = true;
    }
};
const launchNode = (nodeIndex, initialState, isFaulty, port, N, F, runIdentifier) => __awaiter(void 0, void 0, void 0, function* () {
    const app = (0, express_1.default)();
    app.set("trust proxy", 1);
    app.use(express_1.default.json());
    let decision;
    let state = initialState;
    let round = 1;
    const readyStates = Array(N).fill(false);
    let broadcastedInitialMessages = false;
    const goToNextRound = () => {
        round += 1;
        broadcastedInitialMessages = false;
    };
    app.get("/", (req, res) => {
        if (isFaulty) {
            res.status(500).send("Node is faulty");
        }
        else {
            res.status(200).send("Hello World!");
        }
    });
    // start the consensus once all nodes are ready
    app.post("/ready", (req, res) => {
        // faulty nodes can still say they are ready
        if (isReady(readyStates)) {
            return;
        }
        if (typeof req.body.nodeIndex !== "number" ||
            req.body.nodeIndex < 0 ||
            req.body.nodeIndex >= N) {
            throw new Error(`Wrong req body - ${req.body.nodeIndex}`);
        }
        readyStates[req.body.nodeIndex] = true;
        sendIsReadyToAllNodes(nodeIndex, N);
        res.status(200).send();
    });
    app.get("/ready", (req, res) => {
        res.send(`Status - ${isReady(readyStates) ? "ready" : "not ready"}`);
    });
    const receivedObject = {
        P: [],
        R: [],
    };
    app.post("/", (req, res) => {
        // req.body: {nodeIndex: number, round: number, tag: TagType, value: ValueType}
        if (isFaulty) {
            res.status(500).send("Node is faulty");
            return;
        }
        if (decision !== undefined) {
            return;
        }
        if (req.body.tag === "R") {
            // if receivedObject.R is too small (round object doesn't exist), create it
            const lengthDiff = req.body.round - receivedObject.R.length;
            for (let index = 0; index < lengthDiff; index++) {
                receivedObject.R.push({
                    receivedCount: 0,
                    receivedValue: 0,
                });
            }
            receivedObject.R[req.body.round - 1].receivedCount += 1;
            if (req.body.state === 1) {
                receivedObject.R[req.body.round - 1].receivedValue += 1;
            }
            else {
                receivedObject.R[req.body.round - 1].receivedValue -= 1;
            }
            // console.log(
            //   `<-- Received tag=R from Node #${
            //     req.body.nodeIndex
            //   } to Node #${nodeIndex} in round=${req.body.round} with value=${
            //     req.body.state
            //   }, count is ${receivedObject.R[req.body.round - 1].receivedCount}`
            // );
            // take decision if count is greater than N - F
            if (receivedObject.R[req.body.round - 1].receivedCount >= N - F) {
                if (receivedObject.R[req.body.round - 1].receivedValue !== 0) {
                    const v = receivedObject.R[req.body.round - 1].receivedValue < 0 ? 0 : 1;
                    broadcastStateToAllNodes(v, nodeIndex, "P", round, N, F);
                }
                else {
                    broadcastStateToAllNodes(-1, nodeIndex, "P", round, N, F);
                }
            }
        }
        else if (req.body.tag === "P") {
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
            }
            else if (req.body.state === 0) {
                receivedObject.P[req.body.round - 1].receivedZeros += 1;
            }
            else if (req.body.state === -1) {
                receivedObject.P[req.body.round - 1].receivedMinusOnes += 1;
            }
            else {
                throw new Error(`value error - ${req.body.state}`);
            }
            // take decision if condition is met
            if (receivedObject.P[req.body.round - 1].receivedCount >= N - F) {
                logs.push(`RECEIVED_ENOUGH_P_MESSAGES-r${round}-s${step}-#${nodeIndex}`);
                step++;
                if (receivedObject.P[req.body.round - 1].receivedOnes > F + 1) {
                    // decide 1
                    console.log(`DECISION - ${nodeIndex} - 1`);
                    decision = 1;
                    logs.push(`DECISION_r${round}_s${step + 1}-#${nodeIndex}-1`);
                    step++;
                }
                else if (receivedObject.P[req.body.round - 1].receivedZeros > F + 1) {
                    // decide 0
                    console.log(`DECISION - ${nodeIndex} - 0`);
                    decision = 0;
                    logs.push(`DECISION_r${round}_s${step + 1}-#${nodeIndex}-0`);
                    step++;
                }
                else if (receivedObject.P[req.body.round - 1].receivedOnes > 0) {
                    state = 1;
                    goToNextRound();
                    logs.push(`CHANGE_STATE_r${round}_s${step + 1}-#${nodeIndex}-1`);
                    step++;
                }
                else if (receivedObject.P[req.body.round - 1].receivedZeros > 0) {
                    state = 0;
                    goToNextRound();
                    logs.push(`CHANGE_STATE_r${round}_s${step + 1}-#${nodeIndex}-0`);
                    step++;
                }
                else {
                    state = Math.floor((Math.random() * 100) % 2) === 0 ? 0 : 1;
                    goToNextRound();
                    logs.push(`CHANGE_RND_STATE_r${round}_s${step + 1}-#${nodeIndex}-${state}`);
                    step++;
                }
            }
        }
        else {
            throw new Error(`tag error ${req.body.tag}`);
        }
    });
    app.listen(port, () => {
        console.log(`Example app listening on port ${port}`);
        sendIsReadyToAllNodes(nodeIndex, N);
        if (!isFaulty) {
            logs.push(`INITSTATE_r${round}_s${step + 1}-#${nodeIndex}-${state}`);
            step++;
            setInterval(() => {
                iterateBenOr();
            }, 100);
        }
        else {
            logs.push(`FAULTY_r${round}_s${step + 1}-#${nodeIndex}`);
            step++;
        }
    });
    const iterateBenOr = () => {
        // 1st step - wait for nodes to be ready
        if (!isReady(readyStates))
            return;
        // 2nd step - broadcast to all nodes
        if (!broadcastedInitialMessages) {
            broadcastedInitialMessages = true;
            broadcastStateToAllNodes(state, nodeIndex, "R", round, N, F);
            return;
        }
        return;
    };
});
const launchMultipleNodes = (N, F, initialState, runIdentifier) => __awaiter(void 0, void 0, void 0, function* () {
    if (F >= N / 2) {
        throw new Error(`The Ben-or decentralized consensus algorithm needs to have at least half of his processes running - got ${Math.floor((100 * F) / N)}% faulty processes`);
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
        launchNode(index, initialState[index], nodeIsFaultyArray[index], 3000 + index, N, F, runIdentifier);
    }
    // save logs
    setTimeout(() => {
        fs_1.default.writeFile(`logs/${runIdentifier}_logs.logs`, logs.join("\n"), function (err) {
            if (err)
                return console.log(err);
            console.log("logs saved in /logs");
        });
    }, 2000);
    // launch consensus watcher
});
const initialState = [1, 1, 1, 1, 1, 0, 0, 0, 0, 0];
const runIdentifier = new Date().getTime().toString();
launchMultipleNodes(initialState.length, 4, initialState, runIdentifier);
