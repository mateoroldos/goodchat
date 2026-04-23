import "./env.js";
import { goodchat } from "./goodchat.js";
// @ts-ignore TS6133: required for vercel platform detection
import { Elysia } from "elysia";

const { app } = await goodchat.ready;

export default app;
