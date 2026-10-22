import app from "../apps/api/src/server.js";
import { createVercelPathRouter } from "../apps/api/src/vercel-router.js";

export default createVercelPathRouter(app);
