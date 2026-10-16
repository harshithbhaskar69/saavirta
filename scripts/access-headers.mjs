import assert from "node:assert/strict";

export function accessHeaders(secrets) {
  for (const name of ["ACCESS_CLIENT_ID", "ACCESS_CLIENT_SECRET"])
    assert.ok(
      typeof secrets[name] === "string" &&
        secrets[name].length > 0 &&
        !/[\r\n]/.test(secrets[name]),
      `Missing or invalid ${name}`,
    );
  return {
    "CF-Access-Client-Id": secrets.ACCESS_CLIENT_ID,
    "CF-Access-Client-Secret": secrets.ACCESS_CLIENT_SECRET,
  };
}
