import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { createLocalEngineClient } from "../local-engine.js";
import { registerExternalCacheDb } from "../engine/cache.js";

describe("local crawl cache preference", () => {
  afterEach(() => registerExternalCacheDb(null));

  for (const noCache of [true, false, undefined]) {
    it(`passes ${String(noCache)} to every page, including after a scrape failure`, async () => {
      const root = `https://crawl-cache.test/docs/${String(noCache)}`;
      const urls = [root, `${root}/one`, `${root}/two`];
      // Serve discovery from a fixture cache so this test never fetches a website.
      registerExternalCacheDb({
        getCrawledPage: async () => null,
        upsertCrawledPage: async () => undefined,
        getCrawledSite: async () => ({
          links: [root, urls[1], urls[1], urls[2]],
          source: "fixture",
          pagesCrawled: 3,
          crawledAt: new Date(),
          expiresAt: new Date(Date.now() + 60_000),
        }),
        upsertCrawledSite: async () => undefined,
      });
      const client = createLocalEngineClient();
      const calls: Array<{ url: string; noCache?: boolean }> = [];
      client.scrape = async (params) => {
        calls.push(params);
        if (params.url === urls[1]) throw new Error("fixture page failure");
        return { url: params.url, markdown: "fixture page" };
      };
      const result = await client.crawl({ url: root, maxPages: 3, noCache });
      assert.deepEqual(calls.map((p) => p.url), urls);
      assert.deepEqual(calls.map((p) => p.noCache), urls.map(() => noCache));
      assert.equal((result.pages as unknown[]).length, 2);
    });
  }
});
