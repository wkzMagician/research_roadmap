import { defineConfig } from "vite";
import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const roadmapsDirectory = path.join(projectRoot, "data", "roadmaps");
const roadmapIdPattern = /^[a-z0-9][a-z0-9_-]{0,79}$/i;

function sendJson(response, status, body) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(body));
}

function isRoadmap(value) {
  return Boolean(value && value.meta && typeof value.meta.id === "string" && typeof value.meta.title === "string" && Array.isArray(value.nodes) && Array.isArray(value.edges));
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function fileForRoadmap(id) {
  return path.join(roadmapsDirectory, id + ".json");
}

async function readRequestBody(request) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 2 * 1024 * 1024) throw new Error("文件超过 2 MB。");
  }
  return JSON.parse(body);
}

async function listRoadmaps() {
  await mkdir(roadmapsDirectory, { recursive: true });
  const fileNames = await readdir(roadmapsDirectory);
  const filePaths = fileNames.filter((name) => name.endsWith(".json")).map((name) => path.join(roadmapsDirectory, name));
  const roadmaps = [];
  for (const filePath of filePaths) {
    try {
      const roadmap = await readJson(filePath);
      const fileId = path.basename(filePath, ".json");
      if (isRoadmap(roadmap) && roadmap.meta.id === fileId && !roadmaps.some((item) => item.id === roadmap.meta.id)) {
        roadmaps.push({ id: roadmap.meta.id, title: roadmap.meta.title });
      }
    } catch {
      // Ignore malformed files so one draft cannot prevent the app from starting.
    }
  }
  return roadmaps.sort((a, b) => a.title.localeCompare(b.title, "zh-CN"));
}

function roadmapApi() {
  return {
    name: "local-roadmap-json-api",
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const url = new URL(request.url || "/", "http://127.0.0.1");
        if (!url.pathname.startsWith("/api/roadmaps")) return next();

        try {
          if (request.method === "GET" && url.pathname === "/api/roadmaps") {
            return sendJson(response, 200, await listRoadmaps());
          }

          const id = decodeURIComponent(url.pathname.replace("/api/roadmaps/", ""));
          if (!id || !roadmapIdPattern.test(id)) return sendJson(response, 400, { error: "Roadmap id 只能包含字母、数字、- 或 _。" });
          const targetPath = await fileForRoadmap(id);

          if (request.method === "GET") {
            return sendJson(response, 200, await readJson(targetPath));
          }

          if (request.method === "PUT") {
            const roadmap = await readRequestBody(request);
            if (!isRoadmap(roadmap) || roadmap.meta.id !== id) return sendJson(response, 400, { error: "JSON 必须是合法 roadmap，且 meta.id 应与请求一致。" });
            await mkdir(path.dirname(targetPath), { recursive: true });
            const serializedRoadmap = JSON.stringify(roadmap, null, 2) + "\n";
            try {
              if (await readFile(targetPath, "utf8") === serializedRoadmap) return sendJson(response, 200, { ok: true, unchanged: true, path: path.relative(projectRoot, targetPath) });
            } catch (error) {
              if (error?.code !== "ENOENT") throw error;
            }
            const temporaryPath = targetPath + ".tmp";
            await writeFile(temporaryPath, serializedRoadmap, "utf8");
            await rename(temporaryPath, targetPath);
            return sendJson(response, 200, { ok: true, path: path.relative(projectRoot, targetPath) });
          }

          return sendJson(response, 405, { error: "Method not allowed" });
        } catch (error) {
          const status = error && error.code === "ENOENT" ? 404 : 500;
          return sendJson(response, status, { error: error instanceof Error ? error.message : "无法处理 roadmap 请求。" });
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [roadmapApi()],
  server: {
    watch: {
      ignored: ["**/data/**"],
    },
  },
});
