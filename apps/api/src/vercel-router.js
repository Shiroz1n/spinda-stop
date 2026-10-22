const ROUTE_SEGMENT = /^[A-Za-z0-9._~-]+$/;

function apiPathFromRewrite(value) {
  if (!value) return null;
  const segments = value.split("/");
  if (segments.some((segment) => !segment || segment === "." || segment === ".." || !ROUTE_SEGMENT.test(segment))) {
    return null;
  }
  return `/api/${segments.join("/")}`;
}

export function createVercelPathRouter(app) {
  if (!app || typeof app.handle !== "function") throw new TypeError("O adaptador do Vercel precisa receber uma aplicação Elysia.");

  return {
    async fetch(request) {
      const url = new URL(request.url);
      const apiPath = apiPathFromRewrite(url.searchParams.get("__spinda_path"));
      if (!apiPath) {
        return Response.json({ error: { code: "not_found", message: "Rota não encontrada." } }, { status: 404 });
      }

      url.searchParams.delete("__spinda_path");
      url.pathname = apiPath;
      return app.handle(new Request(url, request));
    },
  };
}
