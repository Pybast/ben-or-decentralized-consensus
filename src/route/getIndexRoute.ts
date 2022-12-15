import { Request, Response } from "express";

export const getIndexRoute = (
  req: Request,
  res: Response,
  isFaulty: boolean
) => {
  if (isFaulty) {
    res.status(500).send("Node is faulty");
  } else {
    res.status(200).send("Hello World!");
  }
};
