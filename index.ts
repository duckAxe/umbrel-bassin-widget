import { serve } from "bun";

const REFRESH = "5s";

type Pool = {
  hashrate5m: string;
  hashrate1h: string;
  shares: number;
  bestshare: number;
};

const hashrateSuffix = (value: string): { value: string; unit: string } => {
  const match = value.match(/^([\d.]+)([KMGTPEZY])$/);
  if (!match) return { value, unit: "" };
  const [, num, unit] = match;
  return { value: num.toString(), unit: `${unit}h/s` };
};

const abbreviateNumber = (value: number): { value: string; unit: string } => {
  if (value >= 1e12) return { value: (value / 1e12).toFixed(2), unit: "T" };
  if (value >= 1e9) return { value: (value / 1e9).toFixed(2), unit: "G" };
  if (value >= 1e6) return { value: (value / 1e6).toFixed(2), unit: "M" };
  if (value >= 1e3) return { value: (value / 1e3).toFixed(2), unit: "K" };
  return { value: value.toFixed(2), unit: "" };
};

const errorResponse = () =>
  Response.json({
    type: "four-stats",
    refresh: REFRESH,
    link: "",
    items: [
      { title: "Hashrate", text: "-" },
      { title: "Workers", text: "-" },
      { title: "Best Share", text: "-" },
      { title: "Total Shares", text: "-" },
    ],
  });

serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url);
    const apiUrl = process.env.BASSIN_API_POOL_URL;

    if (url.pathname !== "/widgets/pool") {
      return new Response("Path not found", { status: 404 });
    }
    if (!apiUrl) {
      return new Response("No API url provided", { status: 403 });
    }

    try {
      const response = await fetch(`${apiUrl}?${Date.now()}`);
      if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
      const lines = (await response.text()).trim().split("\n").filter(Boolean);
      if (lines.length < 3) throw new Error("Malformed pool response");

      const [pool, hashrate, shares] = lines.map((line) => JSON.parse(line));

      const hashrate5m = hashrateSuffix(hashrate.hashrate5m);
      const workers = pool.Workers.toString();
      const bestshare = abbreviateNumber(shares.bestshare);
      const accepted = abbreviateNumber(shares.accepted);

      return Response.json({
        type: "four-stats",
        refresh: REFRESH,
        link: "",
        items: [
          { title: "Hashrate", text: hashrate5m.value, subtext: hashrate5m.unit },
          { title: "Workers", text: workers },
          { title: "Best Share", text: bestshare.value, subtext: bestshare.unit },
          { title: "Total Shares", text: accepted.value, subtext: accepted.unit },
        ],
      });
    } catch (error) {
      console.error("Error fetching data:", error);
      return errorResponse();
    }
  },
});
