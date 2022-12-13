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
const broadcastStateToAllNodes = (state, currentNodeIndex, tag, round, N, F) => {
    for (let index = 0; index < N; index++) {
        if (index === currentNodeIndex)
            continue;
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
const launchNode = (nodeIndex, initialState, port, N, F) => __awaiter(void 0, void 0, void 0, function* () {
    const app = (0, express_1.default)();
    app.set("trust proxy", 1);
    app.use(express_1.default.json());
    let state = initialState;
    let round = 1;
    const readyStates = Array(N).fill(false);
    let broadcastedInitialMessages = false;
    let hasReceivedEnoughMessages = false;
    app.get("/", (req, res) => {
        res.send("Hello World!");
    });
    // start the consensus once all nodes are ready
    app.post("/ready", (req, res) => {
        if (isReady(readyStates)) {
            return;
        }
        if (typeof req.body.nodeIndex !== "number" ||
            req.body.nodeIndex < 0 ||
            req.body.nodeIndex >= N) {
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
    app.get("/ready", (req, res) => {
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
    app.post("/", (req, res) => {
        if (req.body.tag === "R") {
            receivedRCount += 1;
            if (req.body.state === 1) {
                receivedRValue += 1;
            }
            else {
                receivedRValue -= 1;
            }
            // take decision if count is greater than N - F
            if (receivedRCount >= N - F) {
                if (receivedRValue !== 0) {
                    const v = receivedRValue < 0 ? 0 : 1;
                    broadcastStateToAllNodes(v, nodeIndex, "P", round, N, F);
                }
                else {
                    broadcastStateToAllNodes(-1, nodeIndex, "P", round, N, F);
                }
            }
        }
        else if (req.body.tag === "P") {
            receivedPCount += 1;
            if (req.body.state === 1) {
                receivedPOne += 1;
            }
            else if (req.body.state === 0) {
                receivedPZero += 1;
            }
            else if (req.body.state === -1) {
                receivedPMinusOne += 1;
            }
            else {
                throw new Error(`value error - ${req.body.state}`);
            }
            // take decision if condition is met
            if (receivedPCount >= N - F) {
                if (receivedPOne > F + 1) {
                    // decide 1
                    console.log(`DECISION - ${nodeIndex} - 1`);
                }
                else if (receivedPZero > F + 1) {
                    // decide 0
                    console.log(`DECISION - ${nodeIndex} - 0`);
                }
                else if (receivedPOne > 0) {
                    state = 1;
                }
                else if (receivedPZero > 0) {
                    state = 0;
                }
                else {
                    state = Math.floor((Math.random() * 100) % 2) === 0 ? 0 : 1;
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
        setInterval(() => {
            iterateBenOr();
        }, 100);
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
const launchMultipleNodes = (N, F, initialState) => __awaiter(void 0, void 0, void 0, function* () {
    if (initialState.length !== N) {
        throw new Error("initial states length doesn't match number of nodes");
    }
    // determines faulty indexes
    for (let index = 0; index < N; index++) {
        // if faulty index => faulty
        launchNode(index, initialState[index], 3000 + index, N, F);
    }
    // launch consensus watcher
});
const initialState = [1, 0, 0];
launchMultipleNodes(3, 1, initialState);
