import { Elysia } from "elysia";
import app from "../apps/api/src/server.js";

if (!(app instanceof Elysia)) throw new Error("A função da API precisa exportar a aplicação Elysia.");

export default app;
