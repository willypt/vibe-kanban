// vite.config.ts
import { sentryVitePlugin } from "@sentry/vite-plugin";
import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import fs from "fs";

function executorSchemasPlugin(): Plugin {
  const VIRTUAL_ID = "virtual:executor-schemas";
  const RESOLVED_VIRTUAL_ID = "\0" + VIRTUAL_ID;

  return {
    name: "executor-schemas-plugin",
    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_VIRTUAL_ID; // keep it virtual
      return null;
    },
    load(id) {
      if (id !== RESOLVED_VIRTUAL_ID) return null;

      const schemasDir = path.resolve(__dirname, "../shared/schemas");
      const files = fs.existsSync(schemasDir)
        ? fs.readdirSync(schemasDir).filter((f) => f.endsWith(".json"))
        : [];

      const imports: string[] = [];
      const entries: string[] = [];

      files.forEach((file, i) => {
        const varName = `__schema_${i}`;
        const importPath = `shared/schemas/${file}`; // uses your alias
        const key = file.replace(/\.json$/, "").toUpperCase(); // claude_code -> CLAUDE_CODE
        imports.push(`import ${varName} from "${importPath}";`);
        entries.push(`  "${key}": ${varName}`);
      });

      // IMPORTANT: pure JS (no TS types), and quote keys.
      const code = `
${imports.join("\n")}

export const schemas = {
${entries.join(",\n")}
};

export default schemas;
`;
      return code;
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    sentryVitePlugin({ org: "bloop-ai", project: "vibe-kanban" }),
    executorSchemasPlugin(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      shared: path.resolve(__dirname, "../shared"),
    },
  },
  server: {
    port: parseInt(process.env.FRONTEND_PORT || "3000"),
    proxy: {
      "/api": {
        target: `http://localhost:${process.env.BACKEND_PORT || "3001"}`,
        changeOrigin: true,
        ws: true,
      }
    },
    fs: {
      allow: [path.resolve(__dirname, "."), path.resolve(__dirname, "..")],
    },
    open: process.env.VITE_OPEN === "true",
    allowedHosts: [
      ".trycloudflare.com", // allow all cloudflared tunnels
    ],
  },
  optimizeDeps: {
    exclude: ["wa-sqlite"],
  },
  build: {
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // React core (cached across deploys)
          if (id.includes('node_modules/react-dom') ||
              id.includes('node_modules/react/') ||
              id.includes('node_modules/react-router')) {
            return 'react-vendor';
          }
          // Rich text editor (~400-600KB)
          if (id.includes('node_modules/lexical') ||
              id.includes('node_modules/@lexical')) {
            return 'lexical';
          }
          // Code editor (~300-400KB)
          if (id.includes('node_modules/@codemirror') ||
              id.includes('node_modules/@uiw/react-codemirror')) {
            return 'codemirror';
          }
          // Git diff viewer (~200-300KB)
          if (id.includes('node_modules/@git-diff-view')) {
            return 'git-diff';
          }
          // JSON Schema forms (~150-200KB)
          if (id.includes('node_modules/@rjsf')) {
            return 'rjsf';
          }
          // UI utilities
          if (id.includes('node_modules/framer-motion') ||
              id.includes('node_modules/@radix-ui')) {
            return 'ui-vendor';
          }
        },
      },
    },
  },
});
