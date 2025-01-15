export const toTimezoneDateString = (date: Date, timezone: number) => {
  return new Date(date.getTime() + timezone * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];
};

export const extractNodeNames = (url: string): string => {
  const urlParts = url.split("://")[1].split("."); // "https://subdomain.domain.com/graphql" → ["subdomain", "domain", "com"]
  return urlParts[0]; // subdomain (ex: "odin-rpc-1")
};
