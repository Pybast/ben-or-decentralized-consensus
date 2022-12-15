# Ben-or Randomized Distributed Asynchronous Consensus Algorithm

This is a proposed implementation of the Ben-Or algorithm. It is considered to be the first randomised consensus algorithm and to be one of the simplest and most elegant one.

## Context

This project was done as part of a Proof os Stake class during my Master 2 studies in Blockchain. The code base is expected to be improved over time so contributions and constructive critics are warmly welcomed.

## How to run this project

1- Install dependencies

```sh
yarn install // or npm install
```

2- Setup number of nodes, max number of faulty nodes and other parameters of the algorithm at the end of the src/index.ts file

3- Run this command

```sh
yarn start // or npm run start
```

4- (Bonus) You need to free up port 3000 to 3000 + N where N is the number of nodes
