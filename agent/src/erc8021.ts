import { config } from "./config.js";

export function appendBuilderCode(calldata: `0x${string}`): `0x${string}` {
  if (!config.erc8021Enabled || !process.env.BUILDER_CODE) {
    return calldata;
  }
  // Append raw hex bytes only; strip 0x prefix from BUILDER_CODE so we don't produce "0x...0x..." (invalid hex)
  const raw = process.env.BUILDER_CODE.replace(/^0x/i, "");
  return `${calldata}${raw}` as `0x${string}`;
}
